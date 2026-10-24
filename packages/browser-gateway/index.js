import { browserPolicy } from '../policy-engine/index.js';
export class FixtureBrowser {
  async call(action, { url = 'https://jobs.example.test' } = {}) {
    browserPolicy(action, url);
    return {
      simulated: true,
      provider: 'fixture',
      url,
      text: 'Page de test locale : trois offres fictives. Aucun accès à Chrome ou au réseau.',
    };
  }
}
