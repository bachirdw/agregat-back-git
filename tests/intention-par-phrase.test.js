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

// Revue Opus du 06/11 (constat 9) : `documents` (« CV adapté », « lettre de motivation », « génère le
// PDF ») passait devant la boîte d'entrée ou la recherche dès que leur objet n'était trouvé que par
// un mot-clé, faute de phrase : pronom accolé (« Cherche-moi »), « les offres de ma pipeline ». Le
// Bilan perdait alors « Mission incomplète » quand la boîte d'entrée n'était pas traitée (dev la
// gardait). Les pronoms accolés au verbe sont retirés avant la comparaison ; le manifeste nomme
// « traite / évalue les offres de ma pipeline ».
test('E68 FICTIF : une demande de documents ne cache plus la boîte d’entrée ni la recherche', () => {
  assert.equal(
    intentOf('Traite les offres de ma pipeline et prépare un CV adapté pour chacune'),
    'pipeline',
  );
  assert.equal(intentOf('Évalue les offres de ma pipeline et génère le PDF du CV'), 'pipeline');
  assert.equal(intentOf('Cherche-moi des jobs data à Paris et prépare un CV adapté'), 'search');
  assert.equal(
    intentOf('Trouve-moi des offres de data engineer à Lyon et rédige une lettre de motivation'),
    'search',
  );
  // La candidature reste une candidature, et un CV seul reste des documents.
  assert.equal(
    intentOf('Postule à cette offre de ma pipeline : https://emplois.example.test/job/1'),
    'apply',
  );
  assert.equal(intentOf('Prépare-moi un CV adapté pour cette offre'), 'documents');
});

// Essai réel du 11/11 (SEEK, rapport 010) : la préparation d'une candidature qui joint un CV déjà
// produit suivait `documents` ; le Bilan réclamait les étapes de fabrication du CV.
test('« Prépare ma candidature … joins mon CV adapté » est une candidature, pas des documents', () => {
  assert.equal(
    intentOf(
      "Prépare ma candidature à l'offre du rapport 010 sur SEEK, dans mon navigateur : ouvre le formulaire de candidature de l'annonce, joins mon CV adapté à cette offre (le PDF déjà produit dans output/), remplis toutes les étapes. Arrête-toi juste avant le bouton d'envoi final.",
    ),
    'apply',
  );
  assert.equal(intentOf('Remplis le formulaire de candidature avec mon CV adapté'), 'apply');
  assert.equal(intentOf('Prepare my application for this job with my tailored CV'), 'apply');
  // The documents themselves stay documents.
  assert.equal(intentOf('Adapte mon CV pour ma candidature chez FICTIF'), 'documents');
  assert.equal(
    intentOf('Prépare mon CV et une lettre de motivation pour cette offre'),
    'documents',
  );
});
