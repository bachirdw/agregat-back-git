// Only platform-owned causes are safe to show for a private career run.
export function careerFailureMessage({ cancelled = false, reason, error } = {}) {
  if (cancelled) return 'Annulée par l’utilisateur';
  if (reason?.message === 'Délai maximal dépassé') return 'Délai maximal dépassé';
  if (error?.code === 'timeout') return 'Délai de réponse de l’agent dépassé';
  if (error?.code === 'exited' || /^Agent arrêté : /.test(error?.message ?? ''))
    return 'Agent arrêté';
  return 'Exécution privée échouée ; consulter les détails techniques.';
}
