import { z } from 'zod';

// Stable capability contracts. Domain packs and agents depend on these ids and schemas — never on a
// concrete provider (fixture, Playwriter relay, isolated Chrome, future cloud browser).
// effect: read = no external side effect; write = changes page/session state; sensitive = may
// submit, pay, send or apply — always requires a human decision at the gateway.
const url = z.string().min(1).max(2048);
const selector = z.string().min(1).max(500);
export const capabilities = [
  {
    id: 'browser.navigate',
    domain: 'browser',
    effect: 'read',
    meter: 'browser_action',
    description: 'Ouvrir une URL autorisée dans un onglet contrôlé par la plateforme.',
    schema: z.object({ url }).strict(),
  },
  {
    id: 'browser.snapshot',
    domain: 'browser',
    effect: 'read',
    meter: 'browser_action',
    description: 'Arbre d’accessibilité textuel de la page courante (ou d’une URL autorisée).',
    schema: z.object({ url: url.optional() }).strict(),
  },
  {
    id: 'browser.extract',
    domain: 'browser',
    effect: 'read',
    meter: 'browser_action',
    description: 'Texte visible d’un élément de la page courante.',
    schema: z
      .object({
        selector: selector.default('body'),
        maxChars: z.number().int().min(1).max(50000).default(20000),
      })
      .strict(),
  },
  {
    id: 'browser.click',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description: 'Cliquer sur un élément ; une action de soumission/envoi/paiement est sensible.',
    schema: z.object({ selector }).strict(),
  },
  {
    id: 'browser.type',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description: 'Saisir du texte ; les champs secrets sont sensibles et jamais journalisés.',
    schema: z.object({ selector, text: z.string().max(10000) }).strict(),
  },
  {
    id: 'browser.upload',
    domain: 'browser',
    effect: 'sensitive',
    meter: 'browser_action',
    description: 'Joindre un fichier du dossier du run à un champ fichier.',
    schema: z.object({ selector, path: z.string().min(1).max(1000) }).strict(),
  },
  {
    id: 'browser.download',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description: 'Télécharger le fichier déclenché par un élément dans le dossier du run.',
    schema: z.object({ selector }).strict(),
  },
];
export const capabilityIds = capabilities.map((c) => c.id);
export function getCapability(id) {
  const c = capabilities.find((x) => x.id === id);
  if (!c) throw new Error(`Capacité inconnue : ${id}`);
  return c;
}
// Public, serialisable view (for the UI, plans and MCP tool descriptions).
export function describeCapabilities(domain) {
  return capabilities.filter((c) => !domain || c.domain === domain).map(({ schema, ...c }) => c);
}
