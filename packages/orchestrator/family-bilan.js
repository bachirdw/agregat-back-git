// chef-01 : the « Sous-missions » section of a mother mission's Bilan (conception 18/11, section 4).
// Written by the platform from what it saw : each sub-mission's own Bilan is QUOTED word for word
// (never rewritten, summarised nor corrected), the totals are counted from the platform's own
// records (states, send counters), and a line confronts the chief's announced sends with them.
// Pure functions : the orchestrator gives the rows, nothing here reads the database.

import { verificationLines } from './roles.js';

// Above this length a quoted Bilan keeps only its send and failed-action lines whole.
export const QUOTE_LIMIT = 3000;
const STATE_LABEL = {
  completed: 'terminée',
  failed: 'en échec',
  cancelled: 'annulée',
  interrupted: 'interrompue',
  queued: 'en file',
  running: 'en cours',
  awaiting_owner: 'attend ta réponse',
  waiting_permission: 'attend ton clic',
};
const LIVING_EXCLUDED = ['completed', 'failed', 'cancelled', 'interrupted'];
export const stateLabel = (state) => STATE_LABEL[state] ?? String(state ?? 'inconnu');

export function formatDuration(ms) {
  const seconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m) return `${m} min ${String(s).padStart(2, '0')} s`;
  return `${s} s`;
}

// The lines kept whole when a Bilan is too long to be quoted entirely.
const KEPT_LINE = /^\s*(?:[-•]\s*)?(?:Envoi|Envois|Action\(s\) échouée\(s\)|Actions? échouées?)/i;
export function quoteBilan(bilan, childId) {
  const text = String(bilan ?? '').trim();
  if (!text) return ['> (aucun Bilan écrit)'];
  if (text.length <= QUOTE_LIMIT) return text.split('\n').map((line) => `> ${line}`.trimEnd());
  const kept = text.split('\n').filter((line) => KEPT_LINE.test(line));
  return [
    ...kept.map((line) => `> ${line}`.trimEnd()),
    `> … Bilan de ${text.length} caractères : texte complet dans la sous-mission ${childId}.`,
  ];
}

// Sends the chief's answer announces (« 4 e-mails envoyés », « j’ai envoyé 2 messages »). Only a
// number next to a send : a number elsewhere in the answer is not a claim.
const SENT_ITEMS = '(?:e-?mails?|courriels?|messages?|candidatures?|envois?|lettres?)';
const CLAIMS = [
  new RegExp(`(\\d{1,4})\\s+${SENT_ITEMS}\\s+(?:(?:ont|a)\\s+été\\s+)?envoy`, 'giu'),
  new RegExp(`envoy\\p{L}*\\s+(\\d{1,4})\\s+${SENT_ITEMS}`, 'giu'),
];
export function announcedSends(answer) {
  const text = String(answer ?? '');
  let total = 0;
  let found = false;
  const seen = new Set();
  for (const pattern of CLAIMS)
    for (const match of text.matchAll(pattern)) {
      if (seen.has(match.index)) continue;
      seen.add(match.index);
      found = true;
      total += Number(match[1]);
    }
  return found ? total : null;
}

// `children` : [{ id, titre, agent, modele, state, durationMs, bilan, envois: { approuves,
// parAccord, refuses }, reprend? }] in launch order (multi-agent-v3-01 D6 : durationMs null = never
// started ; D4 : `reprend` = id of the attempt it resumes) ; `chiefAnswer` : the chief's own answer ; `motherSends` :
// the sends approved in the mother's own mission. delegation-v2-01 : `accord` (how the owner
// accepted the sub-agents) and `synthese` (results that never reached the chief), lines written by
// the orchestrator, are put first and after the sub-missions.
export function familySection({
  children = [],
  chiefAnswer = '',
  motherSends = 0,
  accord = '',
  synthese = '',
} = {}) {
  if (!children.length) return '';
  const lines = [...(accord ? [accord] : []), `Sous-missions (${children.length}) :`];
  const byId = new Map(children.map((child) => [child.id, child]));
  children.forEach((child, index) => {
    const resumed = byId.get(child.reprend);
    lines.push(
      `${index + 1}. « ${child.titre} »${resumed ? ` (reprise de « ${resumed.titre} »)` : ''}${teamLabel(child, byId)} — agent ${child.agent}${child.modele ? `, modèle ${child.modele}` : ''}, ${stateLabel(child.state)}, ${child.durationMs == null ? 'jamais démarrée' : formatDuration(child.durationMs)} (sous-mission ${child.id})`,
      // equipe-01 (E1) : the verdict read by the platform (data reported by the sub-mission).
      ...(child.verdict
        ? [
            `Verdict vu par la plateforme : ${child.verdict.valeur} (source : ${child.verdict.source}${child.verdict.bloquants?.length ? ` ; ${child.verdict.bloquants.length} point(s) bloquant(s)` : ''})`,
          ]
        : []),
      ...quoteBilan(child.bilan, child.id),
    );
  });
  if (synthese) lines.push(synthese);
  const count = (state) => children.filter((child) => child.state === state).length;
  const living = children.filter(
    (child) => !['completed', 'failed', 'cancelled', 'interrupted'].includes(child.state),
  ).length;
  const sum = (key) => children.reduce((n, child) => n + (Number(child.envois?.[key]) || 0), 0);
  const approved = sum('approuves');
  lines.push(
    `Totaux de la famille vus par la plateforme : ${count('completed')} terminée(s), ${count('failed')} en échec, ${count('cancelled')} annulée(s), ${count('interrupted')} interrompue(s)${living ? `, ${living} encore en cours` : ''} ; envois des sous-missions : ${approved} approuvé(s) (dont ${sum('parAccord')} par accord de mission), ${sum('refuses')} refusé(s).`,
  );
  // multi-agent-v3-01 (D4) : with resumed attempts, the tasks counted by their last attempt.
  if (children.some((child) => byId.has(child.reprend))) lines.push(taskLine(children, byId));
  lines.push(...verificationLines(children));
  const announced = announcedSends(chiefAnswer);
  const seen = approved + (Number(motherSends) || 0);
  if (announced !== null && announced !== seen)
    lines.push(
      `Confrontation : le chef annonce ${announced} envoi(s) ; la plateforme a vu ${seen} envoi(s) approuvé(s) dans la famille.`,
    );
  const byAgent = new Map();
  for (const child of children)
    byAgent.set(child.agent, (byAgent.get(child.agent) ?? 0) + (Number(child.durationMs) || 0));
  const total = [...byAgent.values()].reduce((n, ms) => n + ms, 0);
  lines.push(
    `Consommation : ${children.length} sous-mission(s), ${formatDuration(total)} de durée des sous-missions Relay (${[
      ...byAgent,
    ]
      .map(([agent, ms]) => `${agent} ${formatDuration(ms)}`)
      .join(', ')}).`,
  );
  return '\n' + lines.join('\n');
}

// equipe-01 (E1) : « — rôle X, relit « A » » ; empty without role nor reviewed work.
function teamLabel(child, byId) {
  const parts = [
    ...(child.role ? [`rôle ${child.role}`] : []),
    ...(child.relit?.length
      ? [`relit ${child.relit.map((id) => `« ${byId.get(id)?.titre ?? id} »`).join(', ')}`]
      : []),
  ];
  return parts.length ? ` — ${parts.join(', ')}` : '';
}

// A task is the first attempt of a `reprend` chain ; its state is the state of its last attempt.
function taskLine(children, byId) {
  const tasks = new Map();
  for (const child of children) {
    let first = child;
    for (let n = 0; byId.has(first.reprend) && n < children.length; n++)
      first = byId.get(first.reprend);
    const task = tasks.get(first.id) ?? { attempts: 0 };
    tasks.set(first.id, { attempts: task.attempts + 1, last: child });
  }
  const list = [...tasks.values()];
  const count = (state) => list.filter((task) => task.last.state === state).length;
  const living = list.filter((task) => !LIVING_EXCLUDED.includes(task.last.state)).length;
  const after = new Map();
  for (const task of list)
    if (task.last.state === 'completed' && task.attempts > 1)
      after.set(task.attempts - 1, (after.get(task.attempts - 1) ?? 0) + 1);
  const resumed = [...after]
    .sort(([a], [b]) => a - b)
    .map(([reprises, n]) => `${n} après ${reprises} reprise(s)`)
    .join(', ');
  return `Par tâche (dernière tentative) : ${list.length} tâche(s) : ${count('completed')} aboutie(s), ${count('failed')} en échec, ${count('cancelled')} annulée(s), ${count('interrupted')} interrompue(s)${living ? `, ${living} encore en cours` : ''}${resumed ? `, dont ${resumed}` : ''}.`;
}
