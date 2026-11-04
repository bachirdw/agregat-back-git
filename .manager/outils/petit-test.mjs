// Petit test réel : une mission career-ops par l'API du propriétaire, suivie jusqu'à sa fin. N'approuve rien.
const base = 'http://127.0.0.1:4310';
const H = { 'content-type': 'application/json', 'x-platform-request': '1' };
const prompt = [
  'Cherche des offres d’emploi sans scan : utilise seulement la recherche publique jobs_search_live (Arbeitnow, Remotive), requête « AI Engineer ».',
  'Choisis les 2 offres les plus pertinentes pour mon CV, ouvre la page de chacune dans mon Chrome avec les outils navigateur, puis note-la de 1 à 5 avec son rapport A–G seulement après l’avoir lue, et enregistre-la.',
  'N’ouvre aucune page SEEK ni LinkedIn. Ne postule à rien, ne remplis aucun formulaire et n’envoie rien.',
].join('\n');
const body = { prompt, agent: 'claude', pack: 'career-ops', workspace: 'career-ops', model: 'haiku', browser: 'playwriter' };
const res = await fetch(`${base}/api/runs`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const created = await res.json();
if (!res.ok) {
  console.log('REFUS', JSON.stringify(created).slice(0, 400));
  process.exit(1);
}
console.log('mission', created.id);
const deadline = Date.now() + 15 * 60 * 1000;
for (;;) {
  const run = await (await fetch(`${base}/api/runs/${created.id}`)).json();
  if (['completed', 'failed', 'cancelled', 'interrupted'].includes(run.state)) {
    console.log('FIN', run.state, String(run.error ?? '').slice(0, 300));
    break;
  }
  if (Date.now() > deadline) {
    await fetch(`${base}/api/runs/${created.id}/cancel`, { method: 'POST', headers: H, body: '{}' });
    console.log('DÉLAI : mission annulée après 15 min');
    break;
  }
  await new Promise((r) => setTimeout(r, 5000));
}
