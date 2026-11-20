// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/tools/send-task.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/types.ts
// swarm-01 (portage) : the delegation's motive (pourquoi, note) of mission_lancer, checked by a pure
// function. Origin : send-task.ts:79-88 (routingReason, routingNote : max 200) and :230-244 (the
// superRefine : routingReason required with agentId, routingNote at least 10 characters after trim),
// types.ts:501-508 (RoutingReasonSchema). Relay's list replaces swarm's (see NOTES.md) and the
// motive stays optional (plan swarm-01 : observation first) ; `exiger` keeps swarm's rule, off.

// The motives kept by the plan for Relay, in this order (plan swarm-01, DR:209-228).
export const MOTIFS = Object.freeze([
  'parallele',
  'specialite',
  'regard_independant',
  'contexte_trop_long',
  'demande_proprietaire',
]);
// Swarm's list, for the record only (types.ts:501-508) : never given to the agents.
export const SWARM_ROUTING_REASONS = Object.freeze([
  'skill',
  'continuity',
  'overflow',
  'human_pinned',
  'reroute_fault',
]);
// Bounds of the note. Swarm : max 200 on the raw string (z.string().max(200)), at least 10 after
// trim (superRefine). Relay's plan : z.string().trim().min(10).max(200), both after trim.
export const NOTE_MIN = 10;
export const NOTE_MAX = 200;
// Words of the Bilan's line « Motifs des délégations » (decision.js : motifLine).
export const MOTIF_LABELS = Object.freeze({
  parallele: 'parallèle',
  specialite: 'spécialité',
  regard_independant: 'regard indépendant',
  contexte_trop_long: 'contexte trop long',
  demande_proprietaire: 'demande du propriétaire',
});

// checkMotif(args) : never throws. Gives { ok, issues, motif } :
// - issues : [{ path, message }] in swarm's order (motive first, then note), empty when ok ;
// - motif : the cleaned fields to keep ({ pourquoi?, note? } : absent fields stay absent).
// `exiger` (swarm's rule, send-task.ts:230-244 : both required when an agent is named) : off by
// default in Relay ; with it, a missing motive or a note under NOTE_MIN is an issue.
export function checkMotif(args, { exiger = false } = {}) {
  const issues = [];
  const motif = {};
  const source = args && typeof args === 'object' ? args : {};
  const { pourquoi, note } = source;

  if (pourquoi !== undefined) {
    if (typeof pourquoi !== 'string' || !MOTIFS.includes(pourquoi))
      issues.push({
        path: 'pourquoi',
        message: `motif inconnu : un de ${MOTIFS.join(', ')}`,
      });
    else motif.pourquoi = pourquoi;
  } else if (exiger) issues.push({ path: 'pourquoi', message: 'motif requis' });

  if (note !== undefined) {
    // Trap read in swarm (send-task.ts:237) : the minimum is counted after trim, so « ok        »
    // (spaces) does not pass ; Relay trims before both bounds.
    const text = typeof note === 'string' ? note.trim() : null;
    if (text === null) issues.push({ path: 'note', message: 'la note est un texte' });
    else if (text.length < NOTE_MIN)
      issues.push({ path: 'note', message: `au moins ${NOTE_MIN} caractères (espaces retirés)` });
    else if (text.length > NOTE_MAX)
      issues.push({ path: 'note', message: `au plus ${NOTE_MAX} caractères` });
    else motif.note = text;
  } else if (exiger)
    issues.push({ path: 'note', message: `note requise (au moins ${NOTE_MIN} caractères)` });

  return { ok: issues.length === 0, issues, motif };
}

// The words of one motive in the Bilan : « parallèle : note », « parallèle », « note » or « non dit ».
export function motifText({ pourquoi, note } = {}) {
  const label = MOTIF_LABELS[pourquoi];
  if (label && note) return `${label} : ${note}`;
  return label || note || 'non dit';
}
