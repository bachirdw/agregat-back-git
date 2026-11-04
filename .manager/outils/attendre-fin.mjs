// Lecture seule : attend la fin d'une mission, ou un accord en attente depuis plus de 30 s.
const [, , id] = process.argv;
const base = 'http://127.0.0.1:4310';
const deadline = Date.now() + 30 * 60 * 1000;
for (;;) {
  const run = await (await fetch(`${base}/api/runs/${id}`)).json();
  if (['completed', 'failed', 'cancelled', 'interrupted'].includes(run.state)) {
    console.log('FIN', run.state, String(run.error ?? '').slice(0, 300));
    break;
  }
  const pending = await (await fetch(`${base}/api/career/pending`)).json().catch(() => null);
  const list = pending?.pending ?? pending ?? [];
  if (Array.isArray(list) && list.some((p) => Date.now() - new Date(p.createdAt ?? p.at ?? Date.now()).getTime() > 30000)) {
    console.log('ACCORD EN ATTENTE', JSON.stringify(list).slice(0, 300));
    break;
  }
  if (Date.now() > deadline) {
    console.log('TOUJOURS EN COURS après 30 min');
    break;
  }
  await new Promise((r) => setTimeout(r, 5000));
}
