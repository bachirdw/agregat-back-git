import test from 'node:test';
import assert from 'node:assert/strict';
import { missionTitle } from '../packages/orchestrator/title.js';

for (const [prompt, expected] of [
  ['Quelle est la capitale de la France ? Une phrase.', 'Capitale france'],
  ['Ouvre https://www.example.com/a?b=1 et donne le titre de la page.', 'Example.com titre page'],
  ['Cherche-moi un stage en AI engineer à Sydney', 'Stage engineer sydney'],
  ['Réponds uniquement OK', 'Ok'],
  ['À partir du CV joint, cherche des offres de stage à Sydney', 'Offres stage sydney'],
  ['Can you find the latest release notes for Node?', 'Latest release notes'],
  ['Mission privée dans l’espace de candidature', 'Mission privée espace'],
]) {
  test(`titre court : ${prompt}`, () => assert.equal(missionTitle(prompt), expected));
}

test('titre court : prompt vide ou sans mot utile', () => {
  assert.equal(missionTitle(''), 'Mission');
  assert.equal(missionTitle(null), 'Mission');
  assert.equal(missionTitle('Et de la ?'), 'Mission');
});

test('titre court : seule la première phrase compte, taille bornée', () => {
  assert.equal(missionTitle('Analyse budget. Mon mot de passe FICTIF est x'), 'Analyse budget');
  assert.ok(missionTitle('a'.repeat(500)).length <= 40);
});
