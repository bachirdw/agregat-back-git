import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chooseAgent,
  requirementsFor,
  saveProbe,
  loadProbes,
} from '../packages/agent-runtime/index.js';

const dir = () => mkdtempSync(join(tmpdir(), 'relay-probes-'));
const agent = (id, extra = {}) => ({
  id,
  name: id,
  installed: true,
  compatible: true,
  preference: 10,
  ...extra,
});
const agents = [
  { id: 'fixture', simulated: true },
  agent('claude'),
  agent('codex', { preference: 20 }),
];
const route = (probes, extra = {}) =>
  chooseAgent({ agents, requirements: requirementsFor(), live: true, probes, ...extra });

test('sonde : un message sans refus d’authentification précis n’écrit pas inference:false', () => {
  const d = dir();
  for (const msg of [
    'The author of this page asked to login first',
    'Page de login citée dans un échec navigateur',
    'authorized domain list not reachable',
  ])
    saveProbe(d, 'claude', { inference: false, inferenceError: msg });
  assert.equal(loadProbes(d).claude, undefined);
  saveProbe(d, 'claude', { inference: false, inferenceError: 'Authentication required' });
  assert.equal(loadProbes(d).claude.inference, false);
});

test('sonde : une panne réseau ponctuelle n’écrit pas session:false', () => {
  const d = dir();
  saveProbe(d, 'codex', { handshake: true, session: false, error: 'fetch failed ECONNRESET' });
  assert.equal(loadProbes(d).codex.session, undefined);
  saveProbe(d, 'codex', { handshake: true, session: false, error: 'auth_required' });
  assert.equal(loadProbes(d).codex.session, false);
});

test('routage : un test négatif expire, un succès réhabilite, le seul agent restant est retenté', () => {
  const old = new Date(Date.now() - 3600_000).toISOString();
  const recent = new Date().toISOString();
  // négatif ancien : agent de nouveau choisi
  assert.equal(
    route({ claude: { session: false, sessionAt: old, at: old, error: 'auth' } }).id,
    'claude',
  );
  // négatif récent sur claude : codex passe
  assert.equal(
    route({ claude: { session: false, sessionAt: recent, at: recent, error: 'auth' } }).id,
    'codex',
  );
  // tous deux négatifs récents : repli sur le meilleur, jamais « Aucun agent »
  const both = {
    claude: { inference: false, inferenceAt: recent, at: recent },
    codex: { session: false, sessionAt: recent, at: recent },
  };
  const r = route(both);
  assert.equal(r.id, 'claude');
  assert.match(r.reasons[0], /réessayé/);
  // le prochain test réussi réhabilite
  const d = dir();
  saveProbe(d, 'claude', { inference: false, inferenceError: 'invalid api key' });
  saveProbe(d, 'claude', { inference: true, inferenceError: null });
  assert.equal(loadProbes(d).claude.inference, true);
});

test('sonde : expiration OAuth, authentication_error, GEMINI_API_KEY absent marquent l’agent (constat 9)', () => {
  for (const msg of [
    'OAuth token has expired. Please obtain a new token or refresh your existing token.',
    '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}',
    'When using Gemini API, you must specify the GEMINI_API_KEY environment variable.',
    'Please set an Auth method in your settings.json',
    'Error authenticating: Failed to login. Message: Request had invalid authentication credentials.',
    'Invalid API key · Please run /login',
  ]) {
    const d = dir();
    saveProbe(d, 'claude', { inference: false, inferenceError: msg });
    assert.equal(loadProbes(d).claude?.inference, false, msg);
  }
  for (const msg of [
    'The author of this page asked to login first',
    'Le jeton de la page a expiré côté site, rechargement',
    'authorship metadata missing',
    'Gemini answered: GEMINI_API_KEY is documented in the README',
  ]) {
    const d = dir();
    saveProbe(d, 'claude', { inference: false, inferenceError: msg });
    assert.equal(loadProbes(d).claude, undefined, msg);
  }
});
