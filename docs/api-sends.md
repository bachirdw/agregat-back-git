# Envois et brouillons

La classe `send` est imposée par les passerelles. Le mode propriétaire ne la désactive pas.
Une soumission ou un clic assimilé à un envoi montre l’URL, le titre, l’action et la méthode
ainsi que les champs du formulaire et les noms/tailles des pièces jointes. Mots de passe et
champs cachés sont masqués. Un changement de formulaire pendant l’attente invalide l’accord.
LinkedIn refuse toute écriture automatisée ; seul un brouillon et un lien de profil/conversation
sont proposés. L’utilisateur copie le texte et envoie manuellement dans Chrome.

Le frontend consomme les événements `permission` existants et les demandes en cours dans
`GET /api/runs/:id`. Boutons `Approuver l’envoi` / `Refuser`, un par demande.
`POST /api/permissions/:id` avec `{optionId: "allow"}` ou `{optionId: "deny"}`.
Hors mode propriétaire : expiration après 60 secondes. En mode propriétaire, l’accord `send` n’expire
pas (plafond seulement si `AGENT_PLATFORM_SEND_TIMEOUT_MS` est fixé, en ms) ; les délais « outil sans
mise à jour », « agent inactif » et de mission sont suspendus pendant l’attente et reprennent avec le
temps restant ; la mission n’occupe pas l’une des trois places actives. Les autres accords (non `send`)
sont accordés automatiquement en mode propriétaire. Annulation du run = refus.

`GET /api/runs/:id` expose `pendingPermission` (`null` sinon) :
`{id, capability, actionClass: "send", toolCallId, askedAt, preview}` ; `preview` est le titre de
l’action sans secret, en mémoire seulement. Répondre par `POST /api/permissions/:id`. Aucun accord global ou permanent.
Les aperçus complets sont en mémoire pendant la demande et ne sont pas persistés dans SQLite.
Après redémarrage, aucune demande d’envoi n’est réapprouvée automatiquement.

Outil MCP `email_send` (capacité logique `email.send`) :
`{id: UUID, to: email, subject: string, text: string, attachments?: UUID[]}`.
L’ID est une clé d’idempotence : une transmission réservée ou terminée ne peut pas être rejouée.
En cas de timeout SMTP, l’état est `uncertain`, sans retry ; vérifier côté messagerie avant toute
nouvelle tentative. SMTP ne permet pas de garantir une livraison exactement une fois après perte
réseau ; la plateforme empêche la relance automatique susceptible de dupliquer le message.

Configuration **saisie par l’utilisateur**, transmise au seul processus passerelle :
`CAREER_SMTP_HOST`, `CAREER_SMTP_PORT` (465 par défaut), `CAREER_SMTP_FROM`,
`CAREER_SMTP_USER`, `CAREER_SMTP_PASSWORD`. TLS obligatoire hors `127.0.0.1` (SMTP fictif).
Aucune vérification SMTP réelle pendant les tests. Fichiers joints figés avant approbation,
maximum cumulé 10 Mo ; accès fichier/URL implicite de Nodemailer désactivé.

Sans configuration, résultat `{sent:false, draft:UUID, composeUrl, manualSendOnly:true}` :
le brouillon reste dans `drafts/` de l’espace externe et l’UI propose l’ouverture de Gmail
prérempli. Les pièces jointes doivent y être ajoutées manuellement. Aucun message n’est envoyé
par l’ouverture de cette URL.

`GET /api/career/pending` → `{pending: [{id, runId, tool, options, actionClass, expiresAt}]}` :
file globale des envois encore en mémoire, mêmes décisions ponctuelles via `/api/permissions/:id`.
`GET /api/career/drafts` → `{drafts: [{id,to,subject,text,attachments,state}]}` ; état `draft`,
`sent` ou `uncertain`. N’afficher l’ouverture Gmail que pour `draft` ; ne jamais relancer un état
incertain automatiquement. Deux processus MCP concurrents ne peuvent réserver le même ID (création atomique).
L’outil `career_document` transforme un document de `output/` en pièce jointe MD ou PDF locale,
renvoie `{id,name,size,type}` utilisable dans `email_send` ; il préserve le `cv.md` source.

L’outil `linkedin_draft` ouvre automatiquement le profil/conversation via la passerelle navigateur
si elle est disponible ; sinon le lien reste utilisable manuellement. Le texte n’est jamais saisi
dans LinkedIn par l’agent. L’interface affiche le brouillon et un bouton de copie.

## Ce qui demande un clic, ce qui n’en demande pas (mode propriétaire)

Décision du propriétaire du 05/11 : le seul clic humain est celui qui précède un envoi final.

- **Demande un clic (`Approuver l’envoi`, sans expiration sauf plafond)** : le clic ou le téléchargement de
  l’agent sur un bouton d’envoi (soumission de formulaire, y compris un bouton « Continue » placé dans un formulaire, `Envoyer`, `Apply`,
  `Submit`, `Send`), ainsi que
  toute requête qui en découle pendant et après ce clic (fenêtre de 8 s) ; une soumission de formulaire par
  navigation (POST d’un document) ; l’e-mail (`email_send`).
- **Ne demande plus de clic** : toute autre requête réseau d’écriture émise par la page (fetch, mutation
  GraphQL, `apply` ou `send` dans l’URL ou l’opération) quand elle ne suit pas un clic d’envoi approuvé :
  chargement de page, clic sur un élément qui n’est pas un formulaire, étape intermédiaire. Elle est
  accordée automatiquement et tracée : événement `permission_auto` avec la capacité `browser.send`
  (hôte seulement, jamais l’URL, le corps ni la requête), `networkSends` dans le résultat de l’outil
  navigateur, et ligne du Bilan « Requêtes réseau d'envoi : n accordées automatiquement (mode propriétaire) ».
- Restent bloqués sans question : les POST tiers hors navigation (traceurs), les corps de plus de 100 Ko
  non approuvés, tout CAPTCHA ou détection de robot (aucun contournement).
- Hors mode propriétaire rien ne change : chaque écriture demande l’accord.
- Risque accepté : un envoi déclenché par une requête que la page émet hors de tout clic d’envoi (script,
  lien GET) passe sans clic ; il est compté et visible au Bilan.
