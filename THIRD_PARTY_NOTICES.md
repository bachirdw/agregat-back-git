# Dépendances et licences

La boucle typée de `browser.fillForm` est adaptée de
`microsoft/playwright@b8336b3:packages/playwright-core/src/tools/backend/form.ts`,
© Microsoft Corporation, sous licence Apache-2.0. Aucun fichier Playwright n’est copié.
Texte du fichier `NOTICE` de Playwright (Apache-2.0, § 4 d) :

```
Playwright
Copyright (c) Microsoft Corporation

This software contains code derived from the Puppeteer project (https://github.com/puppeteer/puppeteer),
available under the Apache 2.0 license (https://github.com/puppeteer/puppeteer/blob/master/LICENSE).
```

`packages/agent-runtime/process-liveness.js` est adapté de
`openclaw/acpx@c0b9dfd:src/process-liveness.ts` (TypeScript → JavaScript ESM), sous licence MIT.
Écarts : `isProcessAlive` renvoie vrai sur `EPERM` (processus existant d’un autre utilisateur), et
`processGroupState` est un ajout de la plateforme. Licence d’acpx :

```
MIT License

Copyright (c) 2025 OpenClaw Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Aucun code source des projets comparés n'a été copié dans le produit. Les sources de l’ancien audit API restent dans `.research/`, ignoré par Git. Le sprint 01 inspecte 27 clones sous `/Users/diaw/Downloads/agent-repos/` ; SHA, licences réelles et empreintes sont consignés dans `docs/research/sprint-01-inventory.json`.

Dépendances directes verrouillées dans package-lock.json :

- @agentclientprotocol/sdk 2.0.2 : Apache-2.0.
- @agentclientprotocol/codex-acp 2.2.2 : Apache-2.0 ; dépendance optionnelle.
- @agentclientprotocol/claude-agent-acp 0.95.0 : Apache-2.0 ; dépendance optionnelle. Conditions commerciales du runtime Claude distinctes.
- @modelcontextprotocol/sdk 1.32.2 : consulter LICENSE du paquet ; le dépôt upstream traverse une transition MIT / Apache-2.0. Conserver les notices présentes dans le tarball distribué.
- zod 4.6.7 : MIT.
- yaml 2.9.1 : ISC.
- ws 8.22.0 : MIT ; proxy CDP local limité aux onglets Relay (owner-mode-01).
- prettier 3.6.2 : MIT ; outil de développement uniquement.

`npm ls --all` donne l'arbre installé ; les licences complètes sont incluses dans node_modules de chaque paquet. Toute distribution doit conserver ces licences et examiner les transitives, dont les CLI/SDK propriétaires éventuels. Les licences de bibliothèques ne confèrent pas de droit de revendre les services des fournisseurs.

Audit sprint 01 : aucune dépendance du produit ajoutée ou mise à jour. Gemini CLI 0.65.0 (Apache-2.0), OpenCode 1.19.4 (MIT) et l’archive playwright-core 1.64.0-alpha-1790635538000 (Apache-2.0) ont été installés/extraits uniquement sous `/tmp` pour inspection/probes ; ils ne sont pas redistribués avec Relay. Les licences des Skills restent individuelles : les fichiers restrictifs d’Anthropic Skills n’ont pas été copiés dans le produit.

## career-ops (adaptation de méthode)

Les Skills `domain-packs/najah/skills/offer-evaluation` s'inspirent de `modes/fr/offre.md` de
https://github.com/career-ops-hq/career-ops (commit 2d6ed58), sous licence MIT,
© 2026 Santiago Fernández de Valderrama. Le nom « career-ops » est une marque réservée (TRADEMARK.md du
projet) : il est cité pour l'attribution uniquement, pas comme nom de produit.

## Sources de données publiques (Najah)

- Registre des sponsors (gov.uk, Home Office) : Open Government Licence v3.0.
- Remotive API : citer Remotive et renvoyer vers l'URL de l'offre ; ne pas republier vers des sites tiers.
- Arbeitnow API : API publique gratuite ; offres citées avec leur URL d'origine.

## Intégration externe career-ops

Relay intègre l’espace de travail du projet https://github.com/career-ops-hq/career-ops,
commit `2d6ed587e60cbb1aaaac7e3dd4a9f5b7b46a26af`. Code MIT ; marque réservée à son auteur,
citée pour compatibilité et attribution. La licence complète est conservée dans le clone externe.

> MIT License — Copyright (c) 2026 Santiago Fernández de Valderrama.

- nodemailer 10.2.1 : MIT-0 (métadonnées npm et licence du paquet installé vérifiées),
  client SMTP, version épinglée dans package.json et package-lock.json.
