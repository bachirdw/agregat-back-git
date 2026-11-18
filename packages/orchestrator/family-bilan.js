// chef-01 : the « Sous-missions » section of a mother mission's Bilan (conception 18/11, section 4).
// Written by the platform from what it saw : each sub-mission's own Bilan is QUOTED word for word
// (never rewritten, summarised nor corrected), the totals are counted from the platform's own
// records (states, send counters), and a line confronts the chief's announced sends with them.
// Pure functions : the orchestrator gives the rows, nothing here reads the database.

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
// parAccord, refuses } }] in launch order ; `chiefAnswer` : the chief's own answer ; `motherSends` :
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
  children.forEach((child, index) => {
    lines.push(
      `${index + 1}. « ${child.titre} » — agent ${child.agent}${child.modele ? `, modèle ${child.modele}` : ''}, ${stateLabel(child.state)}, ${formatDuration(child.durationMs)} (sous-mission ${child.id})`,
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
    `Consommation : ${children.length} sous-mission(s), ${formatDuration(total)} d’agents cumulés (${[
      ...byAgent,
    ]
      .map(([agent, ms]) => `${agent} ${formatDuration(ms)}`)
      .join(', ')}).`,
  );
  return '\n' + lines.join('\n');
}
