// Page FICTIVE de candidature en trois étapes, servie en local pour les tests (et, à la main,
// pour une mission de démonstration) : aucune donnée réelle, aucun site réel.
// Lancement hors tests : node tests/support/apply-page.js [port ≥ 4320]
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const page = (title, body) =>
  `<!doctype html><html lang="fr"><meta charset="utf-8"><title>${title}</title>` +
  `<body><p><strong>Site FICTIF de test : aucune candidature réelle.</strong></p>${body}</body></html>`;

// nextLabels : libellés des boutons d'étape 1 et 2 (apply-01 : « Suivant → » rejoue un libellé que
// la passerelle ne reconnaît pas comme passage d'étape, comme sur un vrai site).
const step1 = (label) =>
  page(
    'Candidature FICTIVE — étape 1/3',
    `<h1>Candidature FICTIVE (étape 1/3) : identité</h1>
  <form method="post" action="/step2">
    <label>Nom <input name="nom" required></label>
    <label>E-mail <input type="email" name="email" required></label>
    <label>Téléphone <input type="tel" name="telephone"></label>
    <button>${escape(label)}</button>
  </form>`,
  );
const step2 = (label) =>
  page(
    'Candidature FICTIVE — étape 2/3',
    `<h1>Candidature FICTIVE (étape 2/3) : CV</h1>
  <form method="post" action="/step3" enctype="multipart/form-data">
    <label>CV <input type="file" name="cv" accept=".pdf"></label>
    <button>${escape(label)}</button>
  </form>`,
  );
const step3 = (cv) =>
  page(
    'Candidature FICTIVE — étape 3/3',
    `<h1>Candidature FICTIVE (étape 3/3) : questions et envoi</h1>
  <p>CV reçu : <span id="cv-name">${escape(cv || 'aucun')}</span></p>
  <form method="post" action="/submit" onsubmit="window.onbeforeunload = null">
    <label>Disponibilité <select name="disponibilite">
      <option value="">Choisir</option><option>Immédiate</option><option>Sous un mois</option>
    </select></label>
    <label>Motivation <textarea name="motivation"></textarea></label>
    <label><input type="checkbox" name="accord" required> J’accepte le traitement FICTIF</label>
    <button>Envoyer</button>
  </form>
  <script>
    // Une page qui protège la saisie : quitter après une modification ouvre un dialogue.
    const arm = () => {
      window.onbeforeunload = (event) => {
        event.preventDefault();
        event.returnValue = '';
      };
    };
    document.querySelector('form').addEventListener('input', arm);
    document.querySelector('form').addEventListener('change', arm);
  </script>`,
  );
const RECEIVED = page(
  'Candidature FICTIVE reçue',
  '<h1 id="received">Candidature FICTIVE reçue</h1><p>Aucun envoi réel : site de test.</p>',
);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 5_000_000) req.destroy(new Error('Corps trop volumineux'));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// state.sends : envois finaux reçus ; state.cv : nom du dernier fichier reçu à l'étape 2.
export async function startApplyPage({
  port = 0,
  host = '127.0.0.1',
  nextLabels = ['Suivant', 'Suivant'],
} = {}) {
  const [label1 = 'Suivant', label2 = 'Suivant'] = nextLabels;
  if (port && (port < 4320 || [4310, 5173, 19988].includes(port)))
    throw new Error('Port FICTIF : 0 ou ≥ 4320 (jamais 4310, 5173, 19988)');
  const state = { sends: 0, cv: null, steps: [] };
  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://fictif.example.test').pathname;
    const html = (body, status = 200) => {
      res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
    };
    try {
      const body = req.method === 'POST' ? await readBody(req) : null;
      if (req.method === 'POST') state.steps.push(path);
      if (path === '/count') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ sends: state.sends, cv: state.cv, steps: state.steps }));
      }
      if (path === '/') return html(step1(label1));
      if (path === '/step2') return html(step2(label2));
      if (path === '/step3') {
        if (body) state.cv = body.toString('latin1').match(/filename="([^"]*)"/)?.[1] ?? null;
        return html(step3(state.cv));
      }
      if (path === '/submit' && req.method === 'POST') {
        state.sends++;
        return html(RECEIVED);
      }
      return html(page('FICTIF introuvable', '<p>Page FICTIVE introuvable.</p>'), 404);
    } catch {
      if (!res.headersSent) html(page('FICTIF erreur', '<p>Erreur FICTIVE.</p>'), 400);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const origin = `http://${host}:${server.address().port}`;
  return {
    origin,
    state,
    server,
    count: async () => (await fetch(`${origin}/count`)).json(),
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] ?? 4321);
  const { origin } = await startApplyPage({ port });
  console.log(`Page de candidature FICTIVE : ${origin} (compteur : ${origin}/count)`);
}
