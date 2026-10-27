// Loaded only in the three local career-ops checks. They need no network access.
const { syncBuiltinESMExports } = require('node:module');
const denied = () => {
  throw new Error('Réseau interdit pour un contrôle career-ops');
};
for (const [name, methods] of Object.entries({
  net: ['connect', 'createConnection', 'createServer'],
  tls: ['connect', 'createServer'],
  http: ['get', 'request', 'createServer'],
  https: ['get', 'request', 'createServer'],
  dgram: ['createSocket'],
  dns: ['lookup', 'resolve', 'resolve4', 'resolve6'],
})) {
  const module = require(`node:${name}`);
  for (const method of methods) module[method] = denied;
}
require('node:net').Socket.prototype.connect = denied;
require('node:dgram').Socket.prototype.send = denied;
for (const method of ['lookup', 'resolve', 'resolve4', 'resolve6'])
  require('node:dns').promises[method] = denied;
globalThis.fetch = denied;
syncBuiltinESMExports();
