import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { selectSkillIntents, skillManifestSchema } from '../packages/orchestrator/skill-router.js';

// E68 (constaté la nuit du 05 au 06/11, essai C, mission 5fa9108d) : « Postule à cette offre de ma
// pipeline » était suivi comme l'intention `pipeline` (traiter la boîte d'entrée), car le mot-clé
// « pipeline » (priorité 110) l'emportait sur la phrase « postule » (apply, 60) : seule la priorité
// départageait. Une intention nommée par une de ses phrases (ou par son renfort) passe désormais
// avant une intention trouvée par un simple mot-clé ; la priorité départage ensuite. Prompts FICTIFS.
const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const intentOf = (prompt) => selectSkillIntents(prompt, [career])[0]?.intent.id;

test('E68 FICTIF : la phrase de l’objectif l’emporte sur un mot-clé qui nomme la source', () => {
  assert.equal(
    intentOf('Postule à cette offre de ma pipeline : https://emplois.example.test/job/1'),
    'apply',
  );
  assert.equal(intentOf('Évalue cette offre de ma pipeline'), 'evaluate');
  assert.equal(intentOf('Cherche des offres et ajoute-les à ma pipeline'), 'search');
});

test('E68 FICTIF : sans phrase, le mot-clé suffit ; entre phrases, la priorité départage', () => {
  assert.equal(intentOf('Traite ma pipeline'), 'pipeline');
  // « offres en attente » (phrase de pipeline) devant le mot-clé « offres » de search.
  assert.equal(intentOf('Traite les offres en attente'), 'pipeline');
  // Deux phrases : la priorité départage, comme avant (bilan-06, E48) : le renfort du scan (120)
  // l'emporte sur la boîte d'entrée qu'on ne fait que nommer, et « traite » annule ce renfort.
  assert.equal(
    intentOf('Scanne les portails et ajoute les nouvelles offres à la boîte d’entrée'),
    'search',
  );
  assert.equal(intentOf('Scanne les portails puis traite la boîte d’entrée'), 'pipeline');
  assert.equal(intentOf('Traite la boîte d’entrée puis postule aux meilleures'), 'pipeline');
});

// Quatrième relecture de nuit : « linkedin » nu était une phrase de l'intention LinkedIn ; nommée,
// elle passait devant la recherche (« Cherche des jobs sur LinkedIn »). Le manifeste ne garde en
// phrases que ce qui nomme son objet (profil, message, brouillon LinkedIn), « linkedin » reste un
// mot-clé. « Évalue ma pipeline » et « traite ma pipeline » nomment la boîte d'entrée.
test('E68 FICTIF : LinkedIn comme lieu de recherche, pipeline comme objet', () => {
  assert.equal(intentOf('Cherche des jobs sur LinkedIn'), 'search');
  assert.equal(intentOf('Trouve des jobs sur LinkedIn'), 'search');
  assert.equal(intentOf('Cherche sur LinkedIn des offres de développeur'), 'search');
  assert.equal(intentOf('Ajoute les jobs LinkedIn à ma pipeline'), 'pipeline');
  assert.equal(intentOf('Rédige un message LinkedIn au recruteur'), 'linkedin');
  assert.equal(intentOf('Prépare un brouillon LinkedIn'), 'linkedin');
  assert.equal(intentOf('Mets à jour mon profil LinkedIn'), 'linkedin');
  assert.equal(intentOf('Évalue ma pipeline puis postule'), 'pipeline');
  assert.equal(intentOf('Traite ma pipeline et postule aux meilleures'), 'pipeline');
  assert.equal(intentOf('Postule à cette offre de ma pipeline'), 'apply');
  // Cinquième relecture : « prépare un CV » n'est pas une phrase de documents ; ajoutée, elle faisait
  // passer documents (70) devant apply (60) quand le prompt demande aussi de postuler. « Prépare un
  // CV pour les cinq » reste suivi comme une recherche (E54, à trancher : une intention par mission).
  assert.equal(
    intentOf(
      'Prépare un CV et une lettre puis postule à l’offre https://emplois.example.test/job/1',
    ),
    'apply',
  );
  assert.equal(intentOf('Prépare un CV, une lettre et postule'), 'apply');
  assert.equal(intentOf('Cherche des jobs et prépare un CV adapté'), 'search');
  assert.equal(intentOf('Prépare un CV adapté pour les cinq offres'), 'documents');
});
