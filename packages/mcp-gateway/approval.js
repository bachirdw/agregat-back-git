import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { notDone } from '../policy-engine/not-done.js';

// E64 : a decision takes as long as the owner needs (final send : AGENT_PLATFORM_SEND_TIMEOUT_MS,
// or no ceiling at all). The gateway used to cut its request at 130 s while the card stayed open
// for hours, and fetch itself gives up on a response awaited more than 300 s : a late « Approuver »
// then sent nothing. The approval goes through a plain request with no deadline of its own; the
// platform always answers (a decision, an expiry, the end of the run, which also ends this
// process). An optional ceiling (`timeoutMs`, from RELAY_APPROVAL_TIMEOUT_MS) bounds an idle wait.
// `signal` is the agent's call itself : when the agent gives up its tool call (MCP cancellation,
// connection closed), the request is cut, the platform takes the card back and a later
// « Approuver » never sends anything.
// Resolves to true (approved), false (refused) or 'expired'; rejects when no decision came back.
export function requestDecision(url, token, payload, { timeoutMs, signal } = {}) {
  const lost = (why) =>
    notDone(
      `Accord non obtenu (${why}) : action non effectuée, ne la refais pas par une autre voie.`,
    );
  if (signal?.aborted) return Promise.reject(lost('appel annulé'));
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      reject(lost('adresse du pont invalide'));
      return;
    }
    const body = JSON.stringify(payload);
    const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = send(
      target,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'x-platform-request': '1',
          'x-relay-token': token,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('error', () => reject(lost('réponse interrompue')));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve(false);
            return;
          }
          try {
            const decision = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve(decision.expired ? 'expired' : decision.approved === true);
          } catch {
            reject(lost('réponse illisible'));
          }
        });
      },
    );
    const why = {
      RELAY_APPROVAL_TIMEOUT: 'délai dépassé',
      RELAY_APPROVAL_CANCELLED: 'appel annulé',
    };
    req.on('error', (error) => reject(lost(why[error.code] ?? 'pont injoignable')));
    if (timeoutMs > 0)
      req.setTimeout(timeoutMs, () =>
        req.destroy(Object.assign(new Error('timeout'), { code: 'RELAY_APPROVAL_TIMEOUT' })),
      );
    const onCancel = () =>
      req.destroy(Object.assign(new Error('cancelled'), { code: 'RELAY_APPROVAL_CANCELLED' }));
    signal?.addEventListener('abort', onCancel, { once: true });
    req.on('close', () => signal?.removeEventListener('abort', onCancel));
    req.end(body);
  });
}
