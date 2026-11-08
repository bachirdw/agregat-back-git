# Passation du 06/11/2026 (11:55) — nuit du 05 au 06/11, matin du 06/11

Session manager (Claude Opus) ffad0c0a. À lire avant toute reprise, avec le point du matin en tête de
[`nuit-06-11.md`](nuit-06-11.md) (journal horodaté complet) et le [registre](registre-erreurs.md).

## 1. Où est le travail

- **Branche `nuit-06-11`**, worktree `~/Downloads/agregat-back-nuit` (`node_modules` en lien vers
  `agregat-back-dev`), partie de `dev` à d6e8c93. **91 commits** (67 correctifs avec leurs tests, 24 de registre,
  journal et passation) : 76 la nuit, 15 le matin. **Rien n'est fusionné ni poussé.**
- Suite complète verte sur 264fd53 (06/11, 10:42-10:49) : 884 unitaires (882 ✔, 2 ignorés), 157/157 Chrome, contrôle et
  format ; aucun onglet ouvert dans le Chrome du propriétaire pendant la suite.
- `dev` = `main` (d6e8c93), un commit devant `origin` (non poussé, voulu).
- Dossier principal `~/Downloads/agregat-back` (branche `codex/browser-audit-31-10`) : 44 changements non commités,
  anciens, jamais touchés.
- Garder : `git -C ~/Downloads/agregat-back-dev merge --no-ff nuit-06-11` (puis relancer l'API 4310).
  Tout enlever : `git -C ~/Downloads/agregat-back-dev worktree remove --force ~/Downloads/agregat-back-nuit && git -C ~/Downloads/agregat-back-dev branch -D nuit-06-11`.

## 2. Ce qui tourne (11:52)

| Port | Quoi | Où |
|---|---|---|
| 4310 | API `dev` (ancien code), front habituel du propriétaire | onglet de terminal « API 4310 dev », dossier `agregat-back-dev` |
| 4311 | **API de la branche** (mode propriétaire, Playwriter, origine locale 4321) | onglet « API 4311 nuit », dossier `agregat-back-nuit`, données `.data` propres |
| 5173 | front habituel (`~/Downloads/agregat-front`, Vite) → 4310 | lancé par le propriétaire |
| 5174 | **front de test** → 4311 (`AGENT_PLATFORM_API_URL=http://127.0.0.1:4311 npx vite --host 127.0.0.1 --port 5174`) | onglet « Front test 5174 » |
| 4321 | page de candidature FICTIVE (`tests/support/apply-page.js`) | lancée avant la nuit, pid 8672 |
| 19988 | relais Playwriter 0.7.0 (`playwriter-serve`), extension connectée | — |

Le propriétaire teste la branche par http://127.0.0.1:5174 (demande du 06/11) ; aucune mission n'y avait encore été
lancée à 11:52. Lancer ses missions de test depuis 5174 seulement : l'ancien code (4310) se connecte encore au relais
en client « default ». Commande de l'API 4311 : voir le journal (« PORT=4311 … node apps/api/server.js »).

## 3. Fichiers modifiés sur la branche (depuis d6e8c93)

Code (25 fichiers) :
- `packages/browser-gateway/` — `cdp.js` (fenêtre de téléversement E43 et `sendsFile`, garde réseau, ouverture du
  navigateur hors du contexte d'un appel, fermeture `dropConnection` bornée, clic de téléchargement daté, message du
  clic hors zone), `index.js` (revérification après accord E65, `notDone`), `owner-transport.js` (**identifiant de
  client propre `/cdp/relay-<uuid>`**, fermeture de tous les onglets ensemble, connexion neuve si la première est
  coupée).
- `packages/mcp-gateway/` — `server.js` (issue « non effectuée », registre des appels, mesure avant l'action, trace
  des écritures accordées sans signal), `calls.js` (appel en cours, appels finis ignorés), `approval.js` (accord sans
  délai propre, annulé avec l'appel), `meter.js`, `proofs.js` (preuves d'effet, « gain » au chemin exact),
  `outcome.js`.
- `packages/orchestrator/` — `skill-router.js` (visites E41/E67, preuves, pages de liste E56, reprise sûre E57,
  intention nommée E68, pronoms accolés), `index.js` (Bilan des accords et de leur issue, questions, actions natives),
  `exit-code.js`, `proof-args.js`, `native-actions.js`.
- `packages/career-ops/` — `tools.js` (scripts du Skill en mode propriétaire, confinement par chemin réel,
  `career_read` d'un dossier ou d'un motif E71, documents produits), `truth.js` (lignes du Bilan, E26), `produced-
  documents.js`, `sends.js`, `inbox.js`, `attachments.js`.
- `packages/agent-runtime/index.js` (3 s de grâce avant SIGKILL), `packages/policy-engine/not-done.js`,
  `apps/api/server.js` (route tool-outcome : issue des accords, `channel: 'gateway'`), `domain-packs/career-ops/
  skill-manifest.yaml` (phrases, preuves, `listPage`), `scripts/run-tests.js` (deux fichiers Chrome en phase série).

Tests : 24 fichiers nouveaux (dont `appels-rappels-reseau`, `bilan-courriel`, `lecture-dossier`,
`etape-reprise-echec`, `intention-par-phrase`, `preuve-effet`, `televersement-*`, `scripts-skill-proprietaire`) et
7 modifiés (`approval-bridge` : missions en Chrome isolé, `owner-transport` : faux relais au comportement de
Playwriter).

Rapports et outils : `.manager/reports/nuit-06-11.md`, `registre-erreurs.md`, `passation-06-11.md`, `HANDOFF.md` ;
`.manager/outils/` : `suivre-mission.py`, `appels-mission.py`, `page-fictive-flip.mjs` (page FICTIVE qui change
pendant l'attente de l'accord, pour E66), `fermer-onglets-relais.mjs` (ferme des onglets laissés, jamais le front).

## 4. Ce qui est important

- **Cause de E65, E69 et E70 trouvée** (sondes sur le relais réel, code source `cdp-relay.ts` du dépôt de référence
  `remorses__playwriter`) : le relais range ses clients par identifiant (`/cdp/:clientId`, `default` sinon) ; un second
  client `default` est refusé (4004) mais sa fermeture retire le premier de la table, qui reste connecté et muet.
  Corrigé (7be5c83) ; **à confirmer par une longue mission réelle**. La piste « onglet gelé par Chrome » est abandonnée.
- **Un banc de tests pilotait le vrai Chrome du propriétaire** (`approval-bridge` en mode propriétaire, sans navigateur
  nommé : le moteur prend alors Playwriter). Corrigé (0b77b68). Il coupait toute mission en cours (essai A probable).
- **Revue Opus** (5 relecteurs en parallèle, lecture seule) : 20 constats, 0 critique ; 11 importants corrigés (dont
  deux régressions de mes correctifs du matin, E26 et E71), 4 mineurs corrigés, 5 consignés (journal du matin).
- **Vérifié en réel** : E43 (Greenhouse la nuit, **SEEK le matin**), E55, E58, E59, E60, E61, E63, E64, E66, E67, E68,
  E70 (missions courtes). **À vérifier en réel** : E65 et E69 (longue mission), E46, E56 (page de résultats), E57, E62
  (entrées ajoutées puis traitées), E71.
- **Effets sur les données du propriétaire** : son compte SEEK contient désormais le CV adapté du rapport 005 (essai
  V2) ; espace career-ops : rapports 007 (nuit), 008 et 009 (Hume AI, « Skip »), suivi fusionné, entrées de la boîte
  cochées ; seuls des envois FICTIFS (page 4321/4322). Sa mission `e42413d4` (API `dev`) est passée `failed` (attente
  expirée).
- Le Mac du propriétaire peut avoir le **couvercle fermé** (veille de 09:22 à 10:08) : sessions et agents suspendus,
  le maintien en éveil n'y peut rien.
- Consommation : la matinée (revue Opus comprise) a fait passer la limite de 5 h de 4 % à 37 %, la semaine de 64 % à
  68 % (forfait Pro).

## 5. Décisions prises

Du propriétaire (permanentes, voir `CLAUDE.md`) : aucune restriction ajoutée à l'agent en mode propriétaire ; l'envoi
final (candidature, e-mail, message) attend son clic ; aucun push ni merge sans ordre ; bibliothèque career-ops, Skill et
CV intouchés ; aucun secret lu ; `date` avant chaque horodatage ; jamais `git add -A`, `stash`, `reset`.

Du propriétaire, ce jour : finir les tests et les restes, puis **revue par des sous-agents Opus en parallèle** (faite) ;
tester la branche lui-même (environnement 5174 lancé pour lui).

Du manager, ce jour (dans les commits, à revoir si le propriétaire le veut) :
- chaque connexion au relais prend un identifiant propre ; **toute sonde du relais aussi** (`/cdp/<id>`, jamais
  `/cdp` nu) ; aucun test ne doit atteindre le relais (missions de banc en `browser: 'isolated'`) ;
- E71 : `career_read` ne liste pas un dossier (une liste réussie prouverait une lecture d'annonce sur `jds/`) ; le
  refus nomme les fichiers lisibles ;
- E26 : un courriel est demandé si le verbe d'envoi et le mot courriel figurent dans la demande, hors libellé de bouton
  et champ e-mail du candidat, propositions niées ignorées ;
- E57 : une étape échouée n'est reprise que sur une issue sûre (canal passerelle, ou code de sortie lu) ;
- E68 : une intention nommée par une phrase passe avant un mot-clé ; pronoms accolés retirés ; « traite / évalue les
  offres de ma pipeline » nomment la boîte d'entrée ;
- E55 : une preuve « gain » ne compte que le fichier au chemin exact de l'étape ;
- les rappels réseau de Playwriter ne portent plus l'appel qui a ouvert le navigateur ; la trace d'une écriture
  accordée ne dépend plus du signal de l'appel en cours ;
- un accord sans issue rapportée est dit « sans issue connue » au Bilan.

## 6. À trancher par le propriétaire

1. Garder `nuit-06-11` (fusion dans `dev`) ou l'enlever — il teste d'abord par 5174.
2. E43 : compromis du téléversement (une page qui posterait d'elle-même, sans clic, une candidature sans e-mail avec le
   CV vers un autre site dans les 15 s passerait, tracée) ; constat 2 de la revue : l'exception « e-mail » ne lit ni
   l'URL, ni le corps brut quand l'en-tête du fichier y figure, ni « %40 ». Le resserrer ?
3. E59 (migrations du suivi, `set-status --force/--undo` ouverts en mode propriétaire), E54 (une seule intention par
   mission), les quatre points de bilan-06 (recommandé : accepter).

## 7. Reste à faire (manager)

- Vérifier en réel E65 et E69 par une longue mission (15-20 min, phase longue sans navigateur), puis E46, E56 (page
  de résultats), E57, E62, E71 ; relever les résultats des essais du propriétaire sur 5174 et les porter au registre.
- Constats mineurs de la revue non traités : 1 (POST d'un tiers annulé sans être dit pendant un téléversement), 2
  (ci-dessus, avec la décision E43), 4 (`success:false` de `Target.closeTarget` ignoré), 13 (intitulé « in-… » sous un
  segment de liste pris pour un filtre de lieu ; règles propres au site à déclarer au manifeste), 20 (lettre de
  `generate-cover-letter` avec un `--out` nu non reconnue comme produite).
- Entrées anciennes encore ouvertes : E53 (agent silencieux : capturer le stderr de l'adaptateur), E3, E9, E15.
- Branches anciennes à trier (voir « Veille des branches » de `nuit-06-11.md`) ; rien supprimé.
- Fin de session : arrêter 4311 et 5174 si le propriétaire a fini de tester (Ctrl-C dans leurs onglets).

## 8. Prompt de reprise

> Reprends le travail du manager sur Relay. Lis d'abord `~/Downloads/agregat-back-nuit/.manager/reports/passation-06-11.md`,
> puis le point du matin en tête de `nuit-06-11.md` et le registre. La branche `nuit-06-11` n'est ni fusionnée ni
> poussée : ne fusionne et ne pousse rien sans mon ordre. Je teste la branche par http://127.0.0.1:5174 (API 4311) :
> commence par relever mes missions de test et porte leurs résultats au registre, puis vérifie en réel E65 et E69 par
> une longue mission. Rappels : l'envoi final attend mon clic ; aucune restriction ajoutée à l'agent ; aucun secret
> lu ; toute connexion au relais Playwriter en `/cdp/<identifiant-unique>` ; `date` avant chaque horodatage.

## 9. Complément du 08/11 (17:25)

État relevé le 07/11 à 08:18, puis le 08/11 à 17:25 :
- Le 07/11 au matin, le front habituel (5173) parlait à une API 4310 relancée à 08:13 depuis **`~/Downloads/agregat-back`**
  (branche `codex/browser-audit-31-10`, 2 novembre, 44 changements non commités) : un code plus ancien que `dev`,
  **sans** le travail de la nuit. Le propriétaire croyait tester le dernier code : ce n'était pas le cas.
- L'environnement de test de la branche a été relancé le 07/11 (API 4311 depuis `agregat-back-nuit`, front 5174 par
  `AGENT_PLATFORM_API_URL=http://127.0.0.1:4311 npx vite --host 127.0.0.1 --port 5174` dans `agregat-front`).
- **Le 08/11 à 17:25, plus rien ne tourne** (4310, 4311, 5173, 5174 et le relais 19988 libres). Pour tester la branche,
  relancer 4311 et 5174 (commandes ci-dessus et section 2). Aucune mission de test du propriétaire n'a été relevée.
- Branche inchangée depuis 9b4c9e9 (passation du 06/11), toujours ni fusionnée ni poussée.

Ce que le propriétaire veut tester : chercher sur LinkedIn des profils (et des e-mails) de personnes liées à « AI
Engineer », **sans lancer le scan des portails**. Points établis avec lui (lecture du Skill, rien modifié) :
- Le mot « brouillon » au suivi vient seulement du nom de l'intention `linkedin` du manifeste (« Préparer un brouillon
  LinkedIn ») : la plateforme suit une intention par mission (E54) ; ce n'est pas ce que fait l'agent.
- Dans le Skill career-ops, `modes/contacto.md` travaille **pour une offre précise** : contacts déjà enregistrés d'abord
  (`contact-lookup.mjs`, `data/contacts.tsv`), sinon **un seul** contact trouvé par recherche web (3 recherches au plus,
  sans connexion à LinkedIn), puis un message de demande de connexion ; enregistrement du contact seulement avec son
  accord ; **rien n'est envoyé**, le propriétaire copie-colle.
- `modes/email.md` rédige un e-mail de candidature à coller (« Never submit. Never send email. Never click send. ») ; il
  ne cherche pas d'adresses.
- Côté plateforme : `linkedin_draft` rend texte et lien marqués « envoi manuel seulement » ; un message tapé dans
  LinkedIn ou un `email_send` (si un SMTP est configuré dans `secrets.env`, non lu) attend la carte d'accord.
- Prompts conseillés (front 5174) : « Pour l'offre du rapport 005, trouve le bon contact et rédige le message LinkedIn
  (mode contacto). N'envoie rien. » ; « Rédige l'e-mail de candidature pour l'offre du rapport 005 (mode email). ».
  Une recherche large de plusieurs profils n'est pas un mode du Skill : le prompt seul la demande. Avant de lancer :
  extension Playwriter active dans Chrome (sinon bascule en Chrome isolé, sans session LinkedIn) ; CAPTCHA ou
  vérification LinkedIn → arrêt.

Prochaine étape : relancer 4311 et 5174, accompagner le propriétaire sur ces essais (suivre la mission avec
`.manager/outils/suivre-mission.py 4311 <id>`), porter les constats au registre.


- 18:03 (08/11) : API 4311 (onglet « API 4311 nuit ») et front 5174 (onglet « Front test 5174 ») relancés, réponses 200 vérifiées ; relais 19988 et page FICTIVE 4321 non lancés (le relais démarre à la première mission, `relay-start.js`).

## 10. Soir du 08/11 (18:38) : contacto et email du Skill

- Demande du propriétaire : mettre en place et éprouver la prise de contact LinkedIn (mode contacto) et l'e-mail
  (mode email) dans son Chrome. Correctifs e12f33e (E72, E73, E74, registre 5faf845) : intention `linkedin` refaite sur
  contacto, intention `email`, `data/contacts.tsv` optionnel, entrée standard des scripts fermée, lignes du Bilan.
  Suite complète verte (18:34) : 892 unitaires (890, 2 ignorés), 157/157 Chrome, contrôle et format. API 4311 relancée
  sur ce code (18:35).
- Déjà permis en mode propriétaire, sans changement : `career_write data/contacts.tsv`, tout script `.mjs` de la racine
  du Skill (contact-lookup, contacts, contact-extract, linkedin-join) avec ses arguments, navigateur sur linkedin.com et
  mail.google.com ; un bouton « Envoyer »/« Send » (Gmail, LinkedIn) demande le clic du propriétaire ; `browser_press`
  n'admet pas Entrée et `browser_type` remplit sans frappe : pas d'envoi au clavier.
- Essai réel 1, mission bbfd6929 (Sonnet, Chrome du propriétaire par Playwriter, rapport 005 Preacta) : contacto lu,
  rapport lu, contact-lookup (aucun contact), deux pages LinkedIn lues, message de connexion par linkedin_draft, puis
  question « enregistrer le contact dans data/contacts.tsv ? » : **en attente de la réponse du propriétaire** (front 5174).
  Rien envoyé.
- Essai 2 (email dans Gmail) : refusé tant que bbfd6929 attend (« Une seule mission privée à la fois dans cet espace »).
  Prompt prévu : « Rédige l'e-mail de candidature pour l'offre du rapport 005 (mode email) et prépare-le dans Gmail dans
  mon navigateur, jusqu'au bouton Envoyer. N'envoie rien. »
- À vérifier en réel : le Bilan de bbfd6929 (lignes Contacts / Message LinkedIn) ; Gmail ; sur LinkedIn, un bouton
  « Se connecter » qui enverrait l'invitation sans fenêtre de note (mot hors de la liste des envois : à observer).
