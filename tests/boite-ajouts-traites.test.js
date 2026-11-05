import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';
import {
  createTurnTruth,
  formatCareerBilan,
  inboxUnprocessed,
} from '../packages/career-ops/truth.js';

// E62 (constaté le 05/11, mission f336641e) : le Bilan disait « Boîte d’entrée : 3 traitées … 58
// restantes » alors que 5 entrées avaient été cochées « - [x] » : deux des offres évaluées avaient
// été ajoutées à la boîte pendant la même mission, et seules les entrées présentes au départ
// comptaient comme traitées. Les entrées ajoutées puis traitées comptent désormais, et le Bilan le
// dit (« dont N ajoutée(s) pendant la mission »). Espace et URL FICTIFS.
const URLS = [1, 2, 3, 4, 5].map((n) => `https://jobs.example.test/offre/${n}`);
const SKELETON = '# Pipeline — Pending URLs\n\n## Pending\n';
const BEFORE =
  SKELETON +
  `- [ ] ${URLS[0]} | Entreprise FICTIVE A | Poste FICTIF\n` +
  `- [ ] ${URLS[1]} | Entreprise FICTIVE B | Poste FICTIF\n` +
  `- [ ] ${URLS[2]} | Entreprise FICTIVE C | Poste FICTIF\n\n## Processed\n`;
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'boite-ajouts-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'data/pipeline.md'), BEFORE);
  return { root, tools: new CareerTools({ path: () => root }) };
}
const PROMPT = 'Traite la boîte d’entrée FICTIVE';

test('E62 FICTIF : une entrée ajoutée puis traitée dans la mission compte comme traitée', (t) => {
  const { root, tools } = workspace(t);
  const truth = createTurnTruth({ root });
  tools.write(
    'data/pipeline.md',
    SKELETON +
      `- [ ] ${URLS[1]} | Entreprise FICTIVE B | Poste FICTIF\n` +
      `- [ ] ${URLS[2]} | Entreprise FICTIVE C | Poste FICTIF\n` +
      `- [ ] ${URLS[4]} | Entreprise FICTIVE E | Poste FICTIF\n\n## Processed\n` +
      `- [x] #002 | ${URLS[0]} | Entreprise FICTIVE A | Poste FICTIF | 3.0/5 | PDF ❌\n` +
      `- [x] #003 | ${URLS[3]} | Entreprise FICTIVE D | Poste FICTIF | 2.5/5 | PDF ❌\n`,
  );
  truth.recordGatewayTool('career_write', 'completed', { argument: 'data/pipeline.md' });
  assert.deepEqual(truth.inboxDelta(), {
    pending: 3,
    processed: 1,
    unconfirmed: 0,
    remaining: 3,
    missing: 0,
    addedProcessed: 1,
    addedUnconfirmed: 0,
  });
  assert.match(
    formatCareerBilan(PROMPT, truth),
    /- Boîte d’entrée : 2 traitées \(dont 1 ajoutée pendant la mission\), 0 non confirmée \[!\], 3 restantes\./,
  );
});

test('E62 FICTIF : seules des entrées ajoutées traitées → la boîte n’est pas dite « non traitée »', (t) => {
  const { root, tools } = workspace(t);
  const truth = createTurnTruth({ root });
  tools.write(
    'data/pipeline.md',
    BEFORE.replace(
      '\n## Processed\n',
      `\n## Processed\n- [x] #004 | ${URLS[3]} | Entreprise FICTIVE D | Poste FICTIF | 2.5/5 | PDF ❌\n- [!] ${URLS[4]} — Error: login required\n`,
    ),
  );
  truth.recordGatewayTool('career_write', 'completed', { argument: 'data/pipeline.md' });
  assert.equal(inboxUnprocessed(truth, PROMPT), null);
  assert.match(
    formatCareerBilan(PROMPT, truth),
    /- Boîte d’entrée : 1 traitée \(dont 1 ajoutée pendant la mission\), 1 non confirmée \(dont 1 ajoutée pendant la mission\) \[!\], 3 restantes\./,
  );
});

test('E62 FICTIF : sans ajout traité, la ligne et le compte restent inchangés', (t) => {
  const { root, tools } = workspace(t);
  const truth = createTurnTruth({ root });
  tools.write(
    'data/pipeline.md',
    BEFORE.replace(`- [ ] ${URLS[0]} | Entreprise FICTIVE A | Poste FICTIF\n`, '').replace(
      '\n## Processed\n',
      `\n## Processed\n- [x] #002 | ${URLS[0]} | Entreprise FICTIVE A | Poste FICTIF | 3.0/5 | PDF ❌\n`,
    ) + `- [ ] ${URLS[4]} | Entreprise FICTIVE E | Poste FICTIF\n`,
  );
  truth.recordGatewayTool('career_write', 'completed', { argument: 'data/pipeline.md' });
  const delta = truth.inboxDelta();
  assert.equal(delta.processed, 1);
  assert.ok(!('addedProcessed' in delta));
  assert.match(
    formatCareerBilan(PROMPT, truth),
    /- Boîte d’entrée : 1 traitée, 0 non confirmée \[!\]/,
  );
});
