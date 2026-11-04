import { z } from 'zod';

// Stable capability contracts. Domain packs and agents depend on these ids and schemas — never on a
// concrete provider (fixture, Playwriter relay, isolated Chrome, future cloud browser).
// effect: read = no external side effect; write = changes page/session state; sensitive = may
// submit, pay, send or apply — always requires a human decision at the gateway.
const url = z.string().min(1).max(2048);
const selector = z.string().min(1).max(500);
const waitForText = z.string().trim().min(2).max(200);
const scrollMode = z.enum(['bottom', 'page']);
const ref = z
  .string({ error: 'ref requise : recopie eN ou fNeN tel qu’écrit dans [ref=…] du snapshot' })
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
      'Arbre d’accessibilité avec références [ref=eN] et [ref=fNeN] réutilisables dans les actions sur la page courante. Paramètres optionnels : waitForText : attend ce texte avant de capturer (insensible à la casse, 8 s au plus ; la réponse indique waitedFor.found) ; scroll : fait défiler pour charger la suite (bottom : jusqu’en bas, page : d’une hauteur d’écran). À utiliser quand un texte attendu manque à la capture ou que la page charge au défilement.',
    schema: z
      .object({
        url: url.optional(),
        waitForText: waitForText.optional(),
        scroll: scrollMode.optional(),
      })
      .strict(),
  },
  {
    id: 'browser.extract',
    domain: 'browser',
    effect: 'read',
    meter: 'browser_action',
    description:
      'Texte visible de la référence ref du snapshot, ou du sélecteur CSS historique. limit=3 extrait les trois premiers éléments (défaut : 1). Paramètres optionnels : waitForText : attend ce texte avant de capturer (insensible à la casse, 8 s au plus ; la réponse indique waitedFor.found) ; scroll : fait défiler pour charger la suite (bottom ou page). À utiliser quand un texte attendu manque ou que la page charge au défilement.',
    schema: z
      .object({
        ref: ref.optional(),
        selector: selector.optional(),
        limit: z.number().int().min(1).max(20).default(1),
        maxChars: z.number().int().min(1).max(50000).default(20000),
        waitForText: waitForText.optional(),
        scroll: scrollMode.optional(),
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
            { error: 'values doit être une liste de chaînes, par exemple ["Oui"]' },
          )
          .min(1, 'Au moins une option requise')
          .max(20, 'Maximum 20 options'),
      })
      .strict(),
  },
  {
    id: 'browser.fillForm',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Remplir en une action plusieurs champs de l’étape de formulaire visible, dans l’ordre, avec les ref du snapshot : kind text (text), checkbox (checked), radio, select (values). Ne soumet jamais : clique ensuite « Continue » ou « Suivant » avec browser_click. S’arrête au premier champ en échec et nomme ceux déjà remplis.',
    schema: z
      .object({
        fields: z
          .array(
            z
              .object(
                {
                  ref,
                  kind: z.enum(['text', 'checkbox', 'radio', 'select'], {
                    error: 'kind doit valoir text, checkbox, radio ou select',
                  }),
                  text: z
                    .string({ error: 'text doit être une chaîne' })
                    .max(10000, 'text : 10 000 caractères maximum')
                    .optional()
                    .describe('Requis pour kind text, interdit sinon ; chaîne vide = effacer'),
                  checked: z
                    .boolean({ error: 'checked doit être un booléen' })
                    .optional()
                    .describe('Requis pour kind checkbox, interdit sinon'),
                  values: z
                    .array(
                      z
                        .string({ error: 'Chaque option doit être une chaîne' })
                        .min(1, 'Option vide interdite'),
                      {
                        error: 'values doit être une liste de chaînes',
                      },
                    )
                    .min(1, 'Au moins une option requise')
                    .max(20, 'Maximum 20 options')
                    .optional()
                    .describe('Requis pour kind select (valeurs ou libellés), interdit sinon'),
                },
                {
                  // Only the shape error: unknown keys keep zod's precise message.
                  error: (issue) =>
                    issue.code === 'invalid_type'
                      ? 'Chaque champ doit être un objet { ref, kind, … }'
                      : undefined,
                },
              )
              .strict()
              .superRefine((field, ctx) => {
                // Flat fields keep the tool schema simple for every model; one value key per kind.
                const key = { text: 'text', checkbox: 'checked', select: 'values', radio: null }[
                  field.kind
                ];
                for (const name of ['text', 'checked', 'values'])
                  if ((name === key) !== (field[name] !== undefined))
                    ctx.addIssue({
                      code: 'custom',
                      message:
                        name === key
                          ? `${name} requis pour kind ${field.kind}`
                          : `${name} interdit pour kind ${field.kind}`,
                    });
              }),
            { error: 'fields doit être une liste de champs' },
          )
          .min(1, 'Au moins un champ requis')
          .max(30, 'Maximum 30 champs par appel')
          .refine(
            (fields) => new Set(fields.map((f) => f.ref)).size === fields.length,
            'Une ref ne peut apparaître qu’une fois',
          ),
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
    schema: z
      .object({
        ref,
        text: z
          .string({ error: 'text requis (chaîne, vide pour effacer)' })
          .max(10000, 'text : 10 000 caractères maximum'),
      })
      .strict(),
  },
  {
    id: 'browser.press',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Envoyer une touche de navigation (flèches, Échap, Début, Fin) à l’élément ref, par exemple dans une liste d’autocomplétion. En onglet caché, seuls les scripts de la page réagissent (pas d’action par défaut du navigateur) : pour un select natif, utilise browser_select ; pour valider, clique le bouton ; pour écrire, utilise browser_type.',
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
    schema: z
      .object({
        ref,
        path: z.string({ error: 'path requis : fichier du dossier du run' }).min(1).max(1000),
      })
      .strict(),
  },
  {
    id: 'browser.download',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description: 'Télécharger dans le dossier du run le fichier du lien ref du snapshot.',
    schema: z.object({ ref }).strict(),
  },
  {
    id: 'browser.dialog',
    domain: 'browser',
    effect: 'write',
    meter: 'browser_action',
    description:
      'Répondre au dialogue ouvert par la page (alert, confirm, prompt, beforeunload « Quitter la page ? ») : accept true l’accepte, false le refuse ; promptText pour un prompt. Quand une action renvoie dialog: {type, message}, la page attend cette réponse avant toute autre action.',
    schema: z
      .object({
        accept: z.boolean({ error: 'accept doit être un booléen' }),
        promptText: z.string().max(1000, 'promptText : 1 000 caractères maximum').optional(),
      })
      .strict(),
  },
  {
    id: 'browser.verify',
    domain: 'browser',
    effect: 'read',
    meter: 'browser_action',
    description:
      'Relire sans rien modifier : ref seule renvoie la valeur actuelle du champ (texte, option choisie, true/false pour une case, noms de fichiers) ; ref + value compare cette valeur ; text vérifie la présence du texte sur la page (ou dans ref). Renvoie { ok, actual } ; un champ secret ne renvoie que textLength. À utiliser avant « Suivant » ou « Envoyer ».',
    schema: z
      .object({
        ref: ref.optional(),
        text: z
          .string()
          .min(1, 'text vide interdit')
          .max(500, 'text : 500 caractères maximum')
          .optional(),
        value: z.string().max(10000, 'value : 10 000 caractères maximum').optional(),
      })
      .strict()
      .refine(({ ref, text }) => ref || text, 'Fournir ref ou text')
      .refine(({ ref, value }) => value === undefined || ref, 'value exige ref')
      .refine(
        ({ text, value }) => !(text !== undefined && value !== undefined),
        'Fournir value ou text, pas les deux',
      ),
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
