import { z } from 'zod';

// Stable capability contracts. Domain packs and agents depend on these ids and schemas — never on a
// concrete provider (fixture, Playwriter relay, isolated Chrome, future cloud browser).
// effect: read = no external side effect; write = changes page/session state; sensitive = may
// submit, pay, send or apply — always requires a human decision at the gateway.
const url = z.string().min(1).max(2048);
const selector = z.string().min(1).max(500);
const ref = z.string().regex(/^(?:f\d+)?e\d+$/);
const targetBase = z.object({ ref: ref.optional(), selector: selector.optional() });
const target = targetBase.refine(
  ({ ref, selector }) => !!ref !== !!selector,
  'Fournir exactement une référence ref ou un sélecteur selector',
);
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
    description:
      'Arbre d’accessibilité avec références [ref=eN] et [ref=fNeN] réutilisables dans les actions sur la page courante.',
    schema: z.object({ url: url.optional() }).strict(),
  },
  {
    id: 'browser.extract',
    domain: 'browser',
    effect: 'read',
    meter: 'browser_action',
    description:
      'Texte visible de la référence ref du snapshot, ou du sélecteur CSS historique. limit=3 extrait les trois premiers éléments (défaut : 1).',
    schema: z
      .object({
        ref: ref.optional(),
        selector: selector.optional(),
        limit: z.number().int().min(1).max(20).default(1),
        maxChars: z.number().int().min(1).max(50000).default(20000),
      })
      .strict()
      .refine(({ ref, selector }) => !(ref && selector), 'Fournir ref ou selector, pas les deux'),
  },
  {
    id: 'browser.click',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Cliquer sur la référence ref du snapshot (eN ou fNeN) ; une soumission/envoi/paiement demande accord. Sélecteur CSS historique accepté.',
    schema: target.strict(),
  },
  {
    id: 'browser.type',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Saisir du texte dans la référence ref du snapshot ; les champs secrets sont sensibles et jamais journalisés. Sélecteur CSS historique accepté.',
    schema: targetBase
      .extend({ text: z.string().max(10000) })
      .strict()
      .refine(({ ref, selector }) => !!ref !== !!selector),
  },
  {
    id: 'browser.upload',
    domain: 'browser',
    effect: 'sensitive',
    meter: 'browser_action',
    description:
      'Joindre un fichier du dossier du run au champ identifié par ref du snapshot. Sélecteur CSS historique accepté.',
    schema: targetBase
      .extend({ path: z.string().min(1).max(1000) })
      .strict()
      .refine(({ ref, selector }) => !!ref !== !!selector),
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
