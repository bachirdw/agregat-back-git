// Événements contre Bilan : pour une mission, compare ce que la plateforme a enregistré (appels
// d'outils, accords automatiques, captures lisibles, questions, état final) avec ce que le Bilan
// du résumé affirme. Lecture seule de la base ; aucun texte de page, aucun lien complet imprimé.
// Usage : node .manager/outils/bilan-vs-events.mjs <id ou préfixe de mission> [chemin platform.sqlite]
import { DatabaseSync } from 'node:sqlite';

const TOOL =
  /^(?:mcp__[a-z0-9_]+?__)?(browser[_.][a-z]\w*|email_send|career_[a-z]\w*|linkedin_draft|jobs_search_live|activate_skill|google_web_search)$/i;
const toolName = (raw) => {
  const match = String(raw ?? '')
    .trim()
    .match(TOOL);
  return match ? match[1].replace('.', '_').toLowerCase() : null;
};
const host = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return '?';
  }
};

// `run` is the stored run (data JSON), `events` its events ({ type, data }) in order.
export function analyseRun(run, events) {
  const calls = new Map();
  let jdRead = false;
  for (const event of events) {
    if (event.type === 'agent') {
      const update = event.data ?? {};
      if (!['tool_call', 'tool_call_update'].includes(update.sessionUpdate) || !update.toolCallId)
        continue;
      const name =
        toolName(update.title ?? update.rawInput?.name ?? update.rawInput?.tool) ??
        calls.get(update.toolCallId)?.name;
      if (!name) continue;
      const entry = calls.get(update.toolCallId) ?? { name, status: 'pending' };
      entry.name = name;
      if (['completed', 'failed'].includes(update.status)) entry.status = update.status;
      const path = update.rawInput?.path ?? update.rawInput?.arguments?.path;
      if (name === 'career_read' && /^jds\//.test(String(path ?? ''))) jdRead = true;
      calls.set(update.toolCallId, entry);
    } else if (event.type === 'permission_auto') {
      const name = toolName(event.data?.capability);
      const id = event.data?.toolCallId ?? `auto-${calls.size}`;
      if (name && !calls.has(id)) calls.set(id, { name, status: 'approved' });
    }
  }
  const completed = new Set(
    [...calls.values()].filter((c) => c.status === 'completed').map((c) => c.name),
  );
  const observed = new Set([...calls.values()].map((c) => c.name));
  const readable = events
    .filter((e) => e.type === 'browser_evidence' && e.data?.readable === true)
    .map((e) => host(e.data.url));
  const questions = events.filter((e) => e.type === 'question').length;
  const answers = events.filter((e) => e.type === 'answer').length;
  const summary = String(run.result?.summary ?? '');
  const bilanLine = (label) =>
    summary.match(new RegExp(`^- ${label} : (.*)$`, 'mu'))?.[1]?.replace(/\.$/, '') ?? null;
  const successes = (bilanLine('Actions réussies') ?? '')
    .split(/,\s*/)
    .map((s) => s.replace(/\s*\(.*\)$/, '').trim())
    .filter((s) => s && s !== 'aucune observée');
  const missing = bilanLine('Non exécuté');
  const incomplete = /Mission incomplète/u.test(summary);
  const contradictions = [];
  const observations = [];
  for (const name of successes)
    if (!completed.has(name) && !observed.has(name))
      contradictions.push(`Bilan « réussie » : ${name}, aucun appel observé dans les événements`);
  for (const name of completed)
    if (/^(career_offer_save|email_send|career_write)$/.test(name) && !successes.includes(name))
      contradictions.push(`appel terminé ${name} absent des « Actions réussies » du Bilan`);
  if (run.state === 'completed' && incomplete)
    contradictions.push('état « completed » alors que le résumé dit « Mission incomplète »');
  if (incomplete && /aucune action demandée identifiable/u.test(missing ?? ''))
    contradictions.push('« Non exécuté : aucune action demandée » avec « Mission incomplète »');
  if (/\b\d(?:[,.]\d+)?\s*\/\s*5\b/u.test(summary) && !readable.length && !jdRead)
    observations.push('note « N/5 » dans le résumé sans capture lisible ni annonce lue (jds/)');
  const agentText = summary.split(/\nAffirmations de l’agent|\nBilan\n/u)[0].trimEnd();
  if (run.state === 'completed' && !questions && /\?\s*$/u.test(agentText.slice(-400)))
    observations.push(
      'fin sur une question en prose sans attente du propriétaire (état completed)',
    );
  return {
    id: run.id,
    state: run.state,
    calls: [...calls.values()].map((c) => `${c.name}:${c.status}`),
    readablePages: readable,
    questions,
    answers,
    bilan: { successes, missing, incomplete },
    contradictions,
    observations,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''))) {
  const [prefix, file = '.data/platform.sqlite'] = process.argv.slice(2);
  if (!prefix) throw new Error('identifiant de mission manquant');
  const db = new DatabaseSync(file, { readOnly: true });
  const rows = db.prepare('select id, data from runs where id like ?').all(`${prefix}%`);
  if (rows.length !== 1) throw new Error(`${rows.length} mission(s) pour ${prefix}`);
  const run = JSON.parse(rows[0].data);
  const events = db
    .prepare('select type, data from events where run_id = ? order by seq')
    .all(run.id)
    .map((r) => ({ type: r.type, data: JSON.parse(r.data ?? '{}') }));
  console.log(JSON.stringify(analyseRun(run, events), null, 2));
}
