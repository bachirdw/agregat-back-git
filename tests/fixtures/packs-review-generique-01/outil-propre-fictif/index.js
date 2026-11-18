// Pack FICTIF de relecture (review-generique-01) : un outil et un vérificateur propres.
export function register(server) {
  server.registerTool('outil_propre_fictif', { description: 'Outil FICTIF de test' }, async () => ({
    content: [{ type: 'text', text: JSON.stringify({ simulated: true, fictif: true }) }],
  }));
}
export function verify(result) {
  return { ...result, verifiePar: 'outil-propre-fictif' };
}
