export { registerLive } from '../najah/index.js';
export function register() {}
export function verify(result) {
  if (!result || typeof result.summary !== 'string' || !Array.isArray(result.evidence))
    throw new Error('Résultat career-ops invalide');
  return result;
}
