# ADR 005 — Conditions fournisseurs : BYOA local, API et produit hébergé

Statut : décision de conception acceptée ; **autorisation commerciale finale non établie**.
Consultation : 25 octobre 2026 (Sydney). Analyse documentaire ciblée, pas avis juridique. Les pages peuvent évoluer et les contrats signés/régions modifier leur application.

## Décision

Séparer licence du code, méthode d’authentification et contrat du service. Conserver le CLI officiel non modifié et ses méthodes de connexion, les secrets chez l’utilisateur, la consommation BYOA payée directement au fournisseur. Relay peut mesurer son orchestration, mais ne doit jamais refacturer les tokens du CLI BYOA. Ne pas extraire/réutiliser un jeton OAuth du CLI pour appeler directement le service. Aucun compte ou consentement n’est créé par le sprint 01.

Pour les automatisations commerciales, privilégier un chemin API officiellement documenté, dans le contrat applicable. La présence d’une clé n’accorde pas à elle seule des droits de revente ou tous usages. Le mode Managed sera un runtime/contrat distinct ; en particulier, l’offre d’hébergement du binaire Claude Code comporte une restriction d’intermédiation spécifique ci-dessous. Une capacité ACP réussie ne valide pas les CGU.

## Matrice et extraits officiels courts

| Fournisseur | Abonnement personnel / CLI local | API / automatisation / commercial | Extrait et source |
|---|---|---|---|
| **Anthropic / Claude Code** | Free/Pro/Max relèvent des Consumer Terms ; Team/Enterprise/API des Commercial Terms. Ne pas déduire du prix d’un abonnement un droit de mutualiser ses accès. La page d’intégration prévoit des utilisateurs authentifiés avec leurs propres credentials. | Préinstaller/exécuter Claude Code dans un produit/service exige, sauf accord différent, les Commercial Terms : binaire non modifié, aucune méthode d’auth retirée, usage facturé directement à chaque utilisateur. Le fournisseur interdit à l’intégrateur de payer/revendre/intermédier cet usage. L’API directe peut alimenter un produit sous le contrat commercial ; cela ne supprime pas la règle propre au binaire intégré. | « Customers may not pay for, resell, or intermediate Claude usage » — [Claude Code legal/compliance, section intégration produit](https://code.claude.com/docs/en/legal-and-compliance). Contrat API : [Commercial Terms A.1](https://www.anthropic.com/legal/commercial-terms). |
| **OpenAI / Codex** | Le CLI supporte ChatGPT ou clé API, avec règles d’administration/données distinctes. Les conditions générales grand public limitent l’extraction automatisée et la redistribution ; elles ne suffisent pas à qualifier chaque mode Codex documenté. Aucun droit général d’agrégation payante des abonnements établi. | La doc recommande la clé API pour les workflows programmatiques et documente exec/SDK/app-server. Le Services Agreement 2.2 autorise l’intégration API dans des applications pour utilisateurs finaux. Le parcours distinct Sign in with ChatGPT pour apps open source/locales demande de manifester un intérêt spécifique pour une app payante ou distante ; ce n’est pas l’autorisation générale de notre futur SaaS. | « Use API key authentication for programmatic Codex CLI workflows » — [Authentication](https://learn.chatgpt.com/docs/auth). Contrat : [Services Agreement §2.2](https://openai.com/policies/services-agreement/). Parcours tiers : [ChatGPT plan usage](https://developers.openai.com/siwc/token-sharing-open-source). |
| **Google / Gemini CLI** | Les conditions dépendent du service : compte Google/Code Assist, Google AI Pro/Ultra, Standard/Enterprise. Les CGU CLI indiquent explicitement que l’accès direct aux services avec des outils tiers réutilisant OAuth peut violer les conditions. Le mode ACP est aussi officiellement documenté pour les intégrations de développeurs : ne pas transformer cela en interdiction générale d’ACP, ni en autorisation commerciale universelle. | Utiliser une clé Gemini Developer API ou Vertex sous leur contrat, sans réemploi OAuth. Les Gemini API Additional Terms (23 mars 2026) visent les usages professionnels ; restrictions d’âge/région, Paid Services pour clients proposés en EEE/Suisse/Royaume-Uni, traitement de données différent du quota gratuit. Produit final et public visé à vérifier avant commercialisation. | « Directly accessing the services powering Gemini CLI » — [CGU CLI et méthodes d’auth](https://geminicli.com/docs/resources/tos-privacy/). [Mode ACP officiel](https://geminicli.com/docs/cli/acp-mode/), [conditions API](https://ai.google.dev/gemini-api/terms), [Code Assist](https://developers.google.com/gemini-code-assist/resources/privacy-notices). |
| **OpenCode** | Logiciel local sous MIT au SHA inspecté : usage commercial du code permis sous obligations de licence. Cela ne transfère pas les droits d’un abonnement au modèle tiers. Les comptes/tokens fournisseurs ne doivent pas être mutualisés. | Les Terms du 15 août 2026 visent site, inférence et offre hébergée ; ils distinguent explicitement le logiciel open source non hébergé. Zen/Go/hébergement et chaque fournisseur tiers restent soumis à leurs contrats. Aucune permission générale de revente d’un abonnement Zen/Go ni d’OAuth tiers établie dans cette lecture. | « not provided to you on a hosted basis » — [Terms, périmètre OSS et services](https://opencode.ai/legal/terms-of-service). [LICENSE MIT au SHA inspecté](https://github.com/anomalyco/opencode/blob/6806c6e29a7d2087335794d8b86c6031cdb5f6dd/LICENSE). |

Sources OpenAI complémentaires : [intégration programmatique Codex](https://developers.openai.com/blog/codex-as-a-platform), [conditions hors EEE/Suisse/Royaume-Uni](https://openai.com/policies/row-terms-of-use/) et [conditions européennes](https://openai.com/policies/terms-of-use/). Ces textes sont distincts du contrat API. Aucun tarif ou accès modèle n’en est inféré.

La page Consumer Anthropic a été consultée mais servie en coréen par l’outil de recherche ; la variante `?lang=en` était inaccessible. L’affectation Consumer/Commercial et les conditions d’intégration citées reposent sur la page officielle Claude Code en anglais, et non sur une citation anglaise inventée du contrat Consumer. Revoir le contrat exact de l’utilisateur avant lancement commercial.

## Interprétation prudente pour Relay

**Opérationnel techniquement** : lancer le CLI de l’utilisateur via ACP, recevoir les capacités, gérer des permissions et laisser les données d’accès dans les mécanismes officiels. **Non démontré contractuellement** : proposer à tout public une orchestration payante/hébergée fondée sur n’importe quel abonnement personnel. Le BYOA local réduit le transit de secrets ; il n’abolit pas les conditions des services.

La séparation publicitaire/commerciale doit être explicite : frais éventuels de plateforme pour orchestration/outils, consommation fournisseur séparée et inconnue si non fournie. Pour un produit payant/distant, faire confirmer le montage et la méthode d’authentification par fournisseur ; ne pas bloquer le développement des interfaces et tests sans inférence en attendant cette validation.

## Conséquences et alternatives rejetées

Le registre d’agents devrait distinguer compatibilité technique et mode d’usage documenté (local utilisateur / API / hébergé à valider), avec source/date de revue ; ces champs sont **prévus**, pas implémentés dans ce sprint. Pas d’ajout d’un processus de connexion Relay, de collecte d’identifiants ou de modification des configurations globales dans ce sprint.

Rejetés : présenter la licence Apache/MIT d’un adaptateur comme l’autorisation de revendre le modèle ; appeler les endpoints abonnements avec un jeton extrait ; qualifier tout automatisme d’interdit malgré les interfaces officielles ; déclarer tout BYOA commercial autorisé sur la seule présence d’ACP. La validation contractuelle du propriétaire reste un prérequis de distribution commerciale, pas un résultat du handshake.

## Constat live du 25 octobre 2026 (sprint 02) — modèles gratuits OpenCode

Un run réel via ACP avec `opencode/deepseek-v4.1-flash-free` a été **refusé par le modèle lui-même** en
application de la politique des modèles gratuits OpenCode : réponse « Free OpenCode models can't be used for
bulk dataset labeling or as a backend for other services. Sign in to OpenCode Console for that. » (le
raisonnement exposé cite explicitement l'usage « backend » relayé par une autre application).

Décision : la plateforme **ne doit pas** utiliser les modèles gratuits OpenCode comme moteur, ni tenter de
contourner ce refus (reformulation, masquage de l'orchestrateur). En BYOA, OpenCode n'est utilisable qu'avec
le compte/fournisseur propre de l'utilisateur et sous ses conditions. Le refus est désormais présenté comme
« Réponse non structurée de l'agent » avec extrait, au lieu d'une erreur de parseur. Un simple « OK » de
handshake n'avait pas déclenché ce refus : un test de prompt minimal ne prouve pas l'autorisation d'usage.
