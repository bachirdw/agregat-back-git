import { closeSync, constants, openSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { requestPinned } from '../policy-engine/http.js';

const MAX_HOPS = 5;

function fileName(url, headers) {
  const disposition = headers['content-disposition'] ?? '';
  const suggested =
    disposition.match(/filename="?([^";]+)/i)?.[1] ?? new URL(url).pathname.split('/').at(-1);
  return (
    basename(suggested || 'fichier')
      .replace(/[^\w.\- ]/g, '_')
      .slice(0, 120) || 'fichier'
  );
}

// chrome.debugger forbids download-directory settings, so an owner download goes over HTTP with
// the session's cookies. The body stays bounded and cancellable, unlike context.request, which
// buffers it whole before its size can be checked. A Set-Cookie is not stored back in Chrome.
export async function downloadOwnerLink({
  url: start,
  dir,
  policy,
  cookiesFor,
  headers = {},
  signal,
  timeoutMs,
  write = writeFileSync,
}) {
  let url = start;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const { addresses } = await policy.resolveUrl(url);
    const cookies = await cookiesFor(url);
    const response = await requestPinned(url, {
      addresses,
      headers: {
        ...headers,
        ...(cookies.length
          ? { cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; ') }
          : {}),
      },
      signal,
      maxBytes: policy.maxDownloadBytes,
      timeoutMs,
    }).catch((error) => {
      if (signal?.aborted) throw signal.reason;
      if (/trop volumineuse/.test(error.message)) throw new Error('Téléchargement trop volumineux');
      throw error;
    });
    const location = response.headers.location;
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url).href;
      continue;
    }
    if (response.status < 200 || response.status >= 300)
      throw new Error(`Téléchargement HTTP ${response.status}`);
    const name = fileName(url, response.headers);
    const path = resolve(dir, name);
    const fd = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      write(fd, response.body);
    } catch (error) {
      rmSync(path, { force: true });
      throw error;
    } finally {
      closeSync(fd);
    }
    return { url, file: name, bytes: response.body.length, method: 'session-http-link' };
  }
  throw new Error('Trop de redirections de téléchargement');
}
