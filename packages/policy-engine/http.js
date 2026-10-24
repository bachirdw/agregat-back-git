import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { isIP } from 'node:net';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';

// Connect only to the already validated DNS answer. Keep the original Host and TLS servername.
// Never follow redirects here: callers must validate each Location before a new connection.
export function requestPinned(
  raw,
  {
    addresses,
    method = 'GET',
    headers = {},
    body = null,
    signal,
    maxBytes = 10 * 1024 * 1024,
    timeoutMs = 20000,
  } = {},
) {
  const url = new URL(raw);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    !addresses?.length ||
    addresses.some((a) => !isIP(a))
  )
    return Promise.reject(new Error('Connexion sans adresse validée refusée'));
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal.reason);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error('Délai HTTP dépassé')), timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        method,
        headers: { ...headers, 'accept-encoding': 'identity' },
        signal: controller.signal,
        agent: false,
        lookup: (_hostname, options, done) => {
          const records = addresses.map((address) => ({ address, family: isIP(address) }));
          if (options.all) done(null, records);
          else done(null, records[0].address, records[0].family);
        },
      },
      (response) => {
        let size = 0;
        const chunks = [];
        const fail = (error) => {
          response.destroy();
          request.destroy();
          cleanup();
          reject(error);
        };
        if (Number(response.headers['content-length']) > maxBytes)
          return fail(new Error('Réponse trop volumineuse'));
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) return fail(new Error('Réponse trop volumineuse'));
          chunks.push(chunk);
        });
        response.on('error', (error) => {
          cleanup();
          reject(error);
        });
        response.on('end', () => {
          cleanup();
          try {
            let bytes = Buffer.concat(chunks);
            const encoding = response.headers['content-encoding'];
            const decoders = { gzip: gunzipSync, deflate: inflateSync, br: brotliDecompressSync };
            const decode = Object.hasOwn(decoders, encoding) ? decoders[encoding] : null;
            if (encoding && encoding !== 'identity' && !decode)
              throw new Error('Encodage HTTP non pris en charge');
            if (decode) bytes = decode(bytes, { maxOutputLength: maxBytes });
            const outputHeaders = {};
            for (const [key, value] of Object.entries(response.headers))
              if (
                value !== undefined &&
                !['content-encoding', 'content-length', 'transfer-encoding'].includes(key)
              )
                outputHeaders[key] = Array.isArray(value) ? value.join('\n') : value;
            resolve({ status: response.statusCode, headers: outputHeaders, body: bytes });
          } catch (e) {
            reject(
              e.code === 'ERR_BUFFER_TOO_LARGE'
                ? new Error('Réponse trop volumineuse après décompression')
                : e,
            );
          }
        });
      },
    );
    request.on('error', (error) => {
      cleanup();
      reject(controller.signal.aborted ? controller.signal.reason : error);
    });
    if (body) request.write(body);
    request.end();
  });
}
