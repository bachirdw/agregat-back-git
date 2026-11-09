// Audit du 10/11 (constat 8) : the owner-mode navigation journal (RELAY_EVIDENCE_URL) records an
// action already done. When it is unavailable (HTTP error, 15 s elapsed), the action still took
// place : the agent gets its result with a warning, never an error that would make it click again
// (a second application, a second card).
export async function withEvidence(output, post) {
  try {
    if ((await post(output))?.ok) return output;
  } catch {
    /* journal unreachable : reported below */
  }
  return {
    ...output,
    evidence: 'non journalisé',
    evidenceWarning:
      'Action effectuée, mais le journal de navigation de la plateforme ne l’a pas enregistrée : ne la refais pas.',
  };
}
