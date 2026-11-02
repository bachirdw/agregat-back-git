# dl-borne — téléchargement propriétaire borné (PARTIEL, arrêt demandé)

État : **incomplet**. Aucun code ni test n'a été écrit. Arrêt sur demande de la session de reprise (limite Claude presque épuisée). Seul ce rapport est commité.

## Fait
- Branche `dl-borne` créée depuis `origin/cloud-base-suite-astra` (`caf7716`). `AGENTS.md`, constats 6 et 7 de `contre-verif-cloud.md` et section e12cad9 de `relecture-suite-astra.md` (commit `6754f25`) lus.
- Environnement : Node 24 présent dans `/opt/node24/bin` (le Node par défaut est en v22). `npm ci` réussi. Chrome for Testing 153 disponible (`/opt/google/chrome/chrome`), donc un test Chrome réel est possible ici. Aucun test lancé.
- Lecture de playwright-core 1.64.1 (`coreBundle.js`), sans exécution.

## Constats d'analyse (lecture seule, non vérifiés en exécution)
1. `caf7716` : `context.request.get` lit tout le corps, y compris celui d'une 3xx ou d'une erreur, avant le contrôle de taille. Il n'épingle pas le DNS (résolution propre à Playwright après `assertUrl`). Il écrit les `Set-Cookie` dans Chrome à chaque saut. Le journal d'appel de Playwright peut mettre l'URL complète dans les messages d'erreur. Le `secure` est accepté en http sur localhost (`isLocalHostname`).
2. **Hypothèse importante, à vérifier en premier** : `context.cookies()` envoie `Storage.getCookies` sur la session racine (`coreBundle.js:40018`). `owner-transport.js:163-198` refuse toute commande racine hors liste (« Commande globale refusée »). Avec le relais réel, le téléchargement propriétaire échouerait donc dès la lecture des cookies, aussi bien dans `caf7716` que dans e12cad9. Le test Chrome d'e12cad9 simulait `ownerConnection` et ne passait pas par le transport. Pour vérifier : `ownerFixture` de `tests/owner-browser.test.js:1315` (Chrome réel avec `--remote-debugging-port=0`, transport réel), puis `browser.download`. Piste dans le périmètre : `Network.getCookies` sur la session de la page. Sinon il faudrait modifier `owner-transport.js`, qui est hors périmètre.
3. Défauts mineurs d'e12cad9 à ne pas reproduire (relecture `6754f25`, lignes 148-164) : encodage inconnu, majuscules ou `x-gzip`, corps gzip vide ; annulation et délai qui ne couvrent pas `resolveUrl`, `cookies` ni `evaluate` ; `TypeError` si `dropConnection` survient pendant le DNS ; 204 qui laisse un fichier vide ; cookie hors latin-1 (`ERR_INVALID_CHAR`) ; `<base href>` ignoré.

## Conception prévue, non réalisée
- `owner-download.js` : requête épinglée en flux, construite comme `requestPinned`, sans tampon. Compteur sur les octets bruts et sur les octets décodés, gzip, br et deflate à la façon de Playwright. Fichier temporaire `O_EXCL` puis `link` atomique, sans écrasement. Délai par saut qui couvre DNS, cookies et corps. Signal d'annulation vérifié après chaque attente.
- Cookies : filtre RFC 6265 (host-only, suffixe sur frontière de label, chemin, https seul, expirés exclus). Magasin en mémoire limité à l'appel (§5.2-5.3, `Max-Age`, `Expires`, `Domain` refusé hors hôte, identité nom+domaine+chemin), qui masque les cookies Chrome remplacés ou supprimés. Rien n'est écrit dans Chrome.
- URL renvoyée réduite à `origin + pathname`, comme `compactBrowserEvidence`. Aucune URL ni aucun cookie dans les erreurs.

## Reste à faire
Tout le livrable : tests rouges puis verts, implémentation, câblage dans `cdp.js` (dont `dropConnection`), test Chrome, `npm test`, `npm run check` et `npm run format:check`.
