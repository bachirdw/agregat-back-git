export const SERVER_STOPPED = 'Serveur arrêté pendant la mission';

const LIMIT_TEXT =
  /\b(?:usage|rate|session|weekly|daily)[ -]limit\b|hit your (?:\w+ )?limit|quota (?:exceeded|exhausted)|exceeded your (?:current )?quota/i;

// Agents announce a provider limit as text, then end with a bare protocol error: name the real cause.
// Only the limit itself and its retry time are kept, never the agent's text.
export function usageLimitMessage(agentName, text, error) {
  const message = String(error?.message ?? '');
  const bareFailure = /^(?:Internal error|Agent arrêté\b)/i.test(message);
  // Only the last paragraph is the announcement: earlier text can quote limits as content.
  const lastParagraph = String(text ?? '')
    .trim()
    .split(/\n\s*\n/)
    .at(-1);
  const source = LIMIT_TEXT.test(message) ? message : bareFailure ? lastParagraph : '';
  if (!LIMIT_TEXT.test(source)) return null;
  const retry = source.match(/(?:try again at|resets?(?: at)?)\s+([^.\n]{1,40})/i)?.[1]?.trim();
  return `Limite d’usage de ${agentName} atteinte${retry ? ` : réessayer à ${retry}` : ''}. Choisir un autre agent ou attendre.`;
}

// Only platform-owned causes are safe to show for a private career run.
export function careerFailureMessage({ cancelled = false, reason, error } = {}) {
  if (cancelled) return 'Annulée par l’utilisateur';
  if (/^Accord expiré sans réponse\b/.test(error?.message ?? '')) return error.message;
  if (reason?.message === 'Délai maximal dépassé') return 'Délai maximal dépassé';
  if (reason?.message === SERVER_STOPPED) return SERVER_STOPPED;
  if (reason?.code === 'tool_stalled')
    return `Outil sans mise à jour depuis ${Math.max(1, Math.ceil((reason.afterMs || 120000) / 1000))} s${reason.toolTitle === 'Searching the web' ? ' : Searching the web' : ''} ; relancer.`;
  if (reason?.code === 'agent_silent') {
    const ms = reason.afterMs || 180000;
    return `Agent inactif depuis ${ms >= 60000 ? Math.ceil(ms / 60000) + ' min' : Math.ceil(ms / 1000) + ' s'} ; relancer.`;
  }
  if (error?.code === 'timeout') return 'Délai de réponse de l’agent dépassé';
  if (error?.code === 'exited' || /^Agent arrêté : /.test(error?.message ?? ''))
    return 'Agent arrêté';
  if (/^Navigation non prouvée\b/.test(error?.message ?? ''))
    return 'Navigation non prouvée : aucune page ouverte puis observée.';
  if (/^Réponse non structurée de l’agent\b/.test(error?.message ?? ''))
    return 'Réponse non structurée de l’agent.';
  return 'Exécution privée échouée ; consulter les détails techniques.';
}
