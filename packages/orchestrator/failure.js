// Only platform-owned causes are safe to show for a private career run.
export function careerFailureMessage({ cancelled = false, reason, error } = {}) {
  if (cancelled) return 'Annulée par l’utilisateur';
  if (reason?.message === 'Délai maximal dépassé') return 'Délai maximal dépassé';
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
