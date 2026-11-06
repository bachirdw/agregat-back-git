// Variante FICTIVE de tests/support/apply-page.js pour l'essai réel de E66 (hors dépôt) :
// à l'étape 3, la page interroge /flag toutes les 2 s ; après `curl /flip`, elle vide la motivation
// et décoche l'accord, comme une page qui change pendant l'attente de l'accord du propriétaire.
// Lancement : node .manager/outils/page-fictive-flip.mjs 4322 (l'API doit admettre http://127.0.0.1:4322 en origine locale)
import http from 'node:http';

const port = Number(process.argv[2] ?? 4322);
if (port < 4320 || [4310, 4311, 4321, 5173, 19988].includes(port)) throw new Error('Port FICTIF refusé');
const escape = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const page = (title, body) =>
  `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${title}</title>` +
  `<body><p><strong>Site FICTIF de test : aucune candidature réelle.</strong></p>${body}</body></html>`;
const step1 = page(
  'Candidature FICTIVE — étape 1/3',
  `<h1>Candidature FICTIVE (étape 1/3) : identité</h1>
  <form method="post" action="/step2">
    <label>Nom <input name="nom" required></label>
    <label>E-mail <input type="email" name="email" required></label>
    <label>Téléphone <input type="tel" name="telephone"></label>
    <button>Suivant</button>
  </form>`,
);
const step2 = page(
  'Candidature FICTIVE — étape 2/3',
  `<h1>Candidature FICTIVE (étape 2/3) : CV</h1>
  <form method="post" action="/step3" enctype="multipart/form-data">
    <label>CV <input type="file" name="cv" accept=".pdf"></label>
    <button>Suivant</button>
  </form>`,
);
const step3 = (cv) =>
  page(
    'Candidature FICTIVE — étape 3/3',
    `<h1>Candidature FICTIVE (étape 3/3) : questions et envoi</h1>
  <p>CV reçu : <span id="cv-name">${escape(cv || 'aucun')}</span></p>
  <form method="post" action="/submit">
    <label>Disponibilité <select name="disponibilite">
      <option value="">Choisir</option><option>Immédiate</option><option>Sous un mois</option>
    </select></label>
    <label>Motivation <textarea name="motivation"></textarea></label>
    <label><input type="checkbox" name="accord" required> J’accepte le traitement FICTIF</label>
    <button>Envoyer</button>
  </form>
  <script>
    let done = false;
    setInterval(async () => {
      if (done) return;
      try {
        const flag = await (await fetch('/flag')).json();
        if (!flag.flip) return;
        done = true;
        document.querySelector('textarea[name=motivation]').value = '';
        document.querySelector('input[name=accord]').checked = false;
      } catch {}
    }, 2000);
  </script>`,
  );
const RECEIVED = page('Candidature FICTIVE reçue', '<h1 id="received">Candidature FICTIVE reçue</h1><p>Aucun envoi réel : site de test.</p>');
const state = { sends: 0, cv: null, steps: [], flip: false, flipped: null };
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 5_000_000) req.destroy(new Error('trop gros'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
http
  .createServer(async (req, res) => {
    const path = new URL(req.url, 'http://fictif.example.test').pathname;
    const send = (body, type = 'text/html; charset=utf-8', status = 200) => {
      res.writeHead(status, { 'content-type': type });
      res.end(body);
    };
    try {
      const body = req.method === 'POST' ? await readBody(req) : null;
      if (req.method === 'POST') state.steps.push(path);
      if (path === '/count') return send(JSON.stringify(state), 'application/json');
      if (path === '/flag') return send(JSON.stringify({ flip: state.flip }), 'application/json');
      if (path === '/flip') {
        state.flip = true;
        state.flipped = new Date().toISOString();
        return send(JSON.stringify(state), 'application/json');
      }
      if (path === '/unflip') {
        state.flip = false;
        return send(JSON.stringify(state), 'application/json');
      }
      if (path === '/') return send(step1);
      if (path === '/step2') return send(step2);
      if (path === '/step3') {
        if (body) state.cv = body.toString('latin1').match(/filename="([^"]*)"/)?.[1] ?? null;
        return send(step3(state.cv));
      }
      if (path === '/submit' && req.method === 'POST') {
        state.sends++;
        return send(RECEIVED);
      }
      return send(page('FICTIF introuvable', '<p>Page FICTIVE introuvable.</p>'), undefined, 404);
    } catch {
      if (!res.headersSent) send(page('FICTIF erreur', '<p>Erreur FICTIVE.</p>'), undefined, 400);
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`Page FICTIVE (variante E66) : http://127.0.0.1:${port}`));
