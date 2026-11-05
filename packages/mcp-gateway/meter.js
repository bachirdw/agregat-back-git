import { notDone } from '../policy-engine/not-done.js';

// Usage of gateway capabilities is charged by the platform BEFORE the action ; a refused charge
// (budget or monthly cap) refuses the action itself, and so does a charge that could not be made
// (quatrième relecture de nuit : bridge unreachable, no answer within 15 s). Either way nothing was
// done, and the error says so (`actionDone: false`, E66).
export async function chargeUsage(url, token, dimension, units = 1, fetchImpl = fetch) {
  if (!url || !token) throw notDone('Pont de mesure requis pour les actions réelles');
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': token,
      },
      body: JSON.stringify({ dimension, units }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const why = error?.name === 'TimeoutError' ? 'sans réponse en 15 s' : 'pont injoignable';
    throw notDone(`Mesure indisponible (${why}) : action non effectuée`, { cause: error });
  }
  if (!response.ok)
    throw notDone((await response.json().catch(() => ({}))).error ?? 'Mesure refusée');
}
