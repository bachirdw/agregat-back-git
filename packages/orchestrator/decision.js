// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/tools/send-task.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/types.ts
// swarm-01 (plan swarm du 20/11) : the chief's decision « alone or team » and the motive of each
// delegation. Origin of the motive's check : send-task.ts:79-88 (routingReason, routingNote : max
// 200) and :230-244 (the superRefine : routingReason required with agentId, routingNote at least 10
// characters after trim), types.ts:501-508 (RoutingReasonSchema). Relay's list replaces swarm's and
// the motive stays optional (observation first) : `exiger` keeps swarm's rule, off and wired
// nowhere. The thresholds of the decision (ten minutes, a quarter of an hour) live in the chief's
// sentence only (delegation-rule.js), never here. This file imports nothing of the orchestrator.

// The motives of mission_lancer (`pourquoi`), in this order : the schema uses this list.
export const MOTIFS = Object.freeze([
  'parallele',
  'specialite',
  'regard_independant',
  'contexte_trop_long',
  'demande_proprietaire',
]);
// Bounds of the note, both counted after trim (swarm : max on the raw string, min after trim).
export const NOTE_MIN = 10;
export const NOTE_MAX = 200;
// Words of the Bilan's line « Motifs des délégations ».
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
// `exiger` (swarm's rule : both required when an agent is named) : off by default in Relay ; with
// it, a missing motive or a note under NOTE_MIN is an issue. The schema of mission_lancer gives the
// same verdicts (z.enum(MOTIFS), z.string().trim().min(NOTE_MIN).max(NOTE_MAX)).
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

// ---- the chief's decision, read in its final answer (data written by the agent, never an order).

// Characters of the answer where the line « Décision : » is looked for.
export const DECISION_SCAN = 1500;
export const DECISION_REASON_MAX = 200;
// « Décision : seul, parce que … », « **Décision : équipe** », « Decision : Equipe » … : markdown
// marks, accents and case tolerated ; the choice must be a whole word.
const DECISION_LINE =
  /^[\s>#*_-]*d[ée]cision[\s*_]*:[\s*_]*(seule?|[ée]quipe)(?![\p{L}\p{N}])(.*)$/iu;

// readDecision(answer) : { choix: 'seul'|'equipe', raison } of the first line « Décision : … » in
// the first DECISION_SCAN characters, or null. Never throws.
export function readDecision(answer) {
  if (typeof answer !== 'string' || !answer) return null;
  for (const line of answer.slice(0, DECISION_SCAN).split('\n')) {
    const found = DECISION_LINE.exec(line);
    if (!found) continue;
    const choix = /^s/i.test(found[1]) ? 'seul' : 'equipe';
    const raison = found[2]
      .replace(/[*_]+/g, '')
      .replace(/^[\s,;:.—–-]+/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[\s.,;:]+$/, '')
      .slice(0, DECISION_REASON_MAX)
      .trim();
    return { choix, raison };
  }
  return null;
}

const launched = (n) =>
  n > 1
    ? `${n} sous-missions lancées`
    : n === 1
      ? '1 sous-mission lancée'
      : 'aucune sous-mission lancée';

// The Bilan's line of the decision (empty without one). Announced « alone » with sub-missions
// launched : the platform says both, without judging.
export function decisionLine(decision, n = 0) {
  if (!decision || !['seul', 'equipe'].includes(decision.choix)) return '';
  const count = Math.max(0, Number(n) || 0);
  if (decision.choix === 'seul' && count > 0)
    return `Décision annoncée : seul ; ${launched(count)}`;
  const label = decision.choix === 'seul' ? 'seul' : 'équipe';
  return `Décision du chef : ${label}${decision.raison ? `, ${decision.raison}` : ''} (${launched(count)})`;
}

// The Bilan's line of the motives : « Motifs des délégations : « A » (parallèle : note) ; « B »
// (non dit) », or empty when no sub-mission has a motive. children : [{ titre, pourquoi?, motif? }]
// (motif : the note, absent for a private mission).
export function motifLine(children) {
  const list = Array.isArray(children) ? children.filter(Boolean) : [];
  if (!list.some((child) => child.pourquoi || child.motif)) return '';
  return `Motifs des délégations : ${list
    .map(
      (child) =>
        `« ${child.titre} » (${motifText({ pourquoi: child.pourquoi, note: child.motif })})`,
    )
    .join(' ; ')}`;
}
