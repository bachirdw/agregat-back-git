import { z } from 'zod';

// Stable capability contracts. Domain packs and agents depend on these ids and schemas — never on a
// concrete provider (fixture, Playwriter relay, isolated Chrome, future cloud browser).
// effect: read = no external side effect; write = changes page/session state; sensitive = may
// submit, pay, send or apply — always requires a human decision at the gateway.
const url = z.string().min(1).max(2048);
const selector = z.string().min(1).max(500);
const ref = z
  .string()
  .regex(
    /^(?:f\d+)?e\d+$/,
    'Référence invalide : recopie eN ou fNeN tel qu’écrit dans [ref=…] du snapshot',
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
      .refine(({ ref, selector }) => !(ref && selector), 'Fournir ref ou selector, pas les deux')
      .refine(
        ({ ref, limit }) => !(ref && limit > 1),
        'limit > 1 exige un sélecteur CSS : une ref désigne un seul élément',
      ),
  },
  {
    id: 'browser.click',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Cliquer sur ref du snapshot (eN ou fNeN) ; clickMode vaut mouse ou dom, hidden indique si l’onglet était caché. Une soumission/envoi/paiement demande accord.',
    schema: z.object({ ref }).strict(),
  },
  {
    id: 'browser.check',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Cocher ou décocher une case, ou cocher un bouton radio identifié par ref du snapshot. Aucun clic si l’état demandé est déjà atteint.',
    schema: z
      .object({ ref, checked: z.boolean({ error: 'checked doit être un booléen' }) })
      .strict(),
  },
  {
    id: 'browser.select',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Choisir une ou plusieurs options d’une liste select par ref du snapshot ; values contient leurs valeurs ou leurs libellés.',
    schema: z
      .object({
        ref,
        values: z
          .array(
            z
              .string({ error: 'Chaque option doit être une chaîne' })
              .min(1, 'Option vide interdite'),
          )
          .min(1, 'Au moins une option requise')
          .max(20, 'Maximum 20 options'),
      })
      .strict(),
  },
  {
    id: 'browser.type',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Saisir du texte dans le champ ref du snapshot (remplace son contenu) ; value est renvoyé si le site reformate la saisie. Les champs secrets sont sensibles et jamais journalisés.',
    schema: z.object({ ref, text: z.string().max(10000) }).strict(),
  },
  {
    id: 'browser.press',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Envoyer une touche de navigation (flèches, Échap, Début, Fin) à l’élément ref, par exemple dans une liste d’autocomplétion. Pour valider, clique le bouton ; pour écrire, utilise browser_type.',
    schema: z
      .object({
        ref,
        key: z.enum(['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Escape', 'Home', 'End'], {
          error:
            'Touche non autorisée : ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Escape, Home ou End',
        }),
      })
      .strict(),
  },
  {
    id: 'browser.upload',
    domain: 'browser',
    effect: 'sensitive',
    meter: 'browser_action',
    description:
      'Joindre un fichier du dossier du run : ref du champ fichier, ou du bouton « Joindre » qui ouvre le sélecteur de fichier (jamais un bouton d’envoi).',
    schema: z.object({ ref, path: z.string().min(1).max(1000) }).strict(),
  },
  {
    id: 'browser.download',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description: 'Télécharger dans le dossier du run le fichier du lien ref du snapshot.',
    schema: z.object({ ref }).strict(),
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
