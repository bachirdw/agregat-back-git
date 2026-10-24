import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Usage meters, measured separately as required by the business model. `billable: false` meters are
// observed for transparency only: tokens of a user's own CLI (BYOA) are never billed by the platform.
export const meters = {
  workflow_run: { category: 'Workflows', unit: 'exécution', billable: true },
  tool_call: { category: 'Outils plateforme', unit: 'appel', billable: true },
  data_search: { category: 'Recherches de données', unit: 'requête', billable: true },
  browser_action: { category: 'Actions navigateur', unit: 'action', billable: true },
  document_generation: { category: 'Documents', unit: 'document', billable: true },
  managed_model_tokens: {
    category: 'Modèles (mode Managed)',
    unit: '1 000 tokens',
    billable: true,
  },
  infra_seconds: { category: 'Infrastructure', unit: 'seconde', billable: true },
  byoa_model_turn: {
    category: 'Modèles BYOA (fournisseur de l’utilisateur)',
    unit: 'tour',
    billable: false,
  },
  tool_observed: { category: 'Outils natifs observés', unit: 'appel', billable: false },
  fixture_turn: { category: 'Démonstrateur', unit: 'tour', billable: false },
  // legacy dimensions kept readable for existing ledgers
  workflow: { category: 'Workflows', unit: 'exécution', billable: true },
  search: { category: 'Recherches de données', unit: 'requête', billable: true },
};

// MVP: no price is invented. Every billable unit costs 0 unless the operator configures a price list.
export function defaultPricing() {
  return {
    currency: 'EUR',
    centsPerUnit: Object.fromEntries(Object.keys(meters).map((m) => [m, 0])),
    monthlyCapCents: null,
  };
}
export function validatePricing(raw) {
  const p = defaultPricing();
  if (raw.currency !== undefined) {
    if (!/^[A-Z]{3}$/.test(raw.currency)) throw new Error('Devise invalide');
    p.currency = raw.currency;
  }
  for (const [m, cents] of Object.entries(raw.centsPerUnit ?? {})) {
    if (!Object.hasOwn(meters, m)) throw new Error(`Mètre inconnu : ${m}`);
    if (!Number.isFinite(cents) || cents < 0) throw new Error(`Prix invalide pour ${m}`);
    if (!meters[m].billable && cents !== 0)
      throw new Error(`${m} n’est pas facturable (BYOA ou observation) : prix interdit`);
    p.centsPerUnit[m] = cents;
  }
  if (raw.monthlyCapCents !== undefined && raw.monthlyCapCents !== null) {
    if (!Number.isSafeInteger(raw.monthlyCapCents) || raw.monthlyCapCents < 0)
      throw new Error('Plafond mensuel invalide');
    p.monthlyCapCents = raw.monthlyCapCents;
  }
  return p;
}
export function loadPricing(dataDir) {
  const file = resolve(dataDir, 'pricing.json');
  if (!existsSync(file)) return defaultPricing();
  return validatePricing(JSON.parse(readFileSync(file, 'utf8')));
}
export function priceOf(dimension, units, pricing) {
  const meter = meters[dimension];
  if (!Object.hasOwn(meters, dimension)) throw new Error(`Mètre inconnu : ${dimension}`);
  if (!Number.isFinite(units) || units < 0 || units > Number.MAX_SAFE_INTEGER)
    throw new Error('Unités invalides');
  if (!meter.billable) return 0;
  const cents = Math.ceil(units * (pricing.centsPerUnit[dimension] ?? 0));
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Coût invalide');
  return cents;
}

// Estimate of declared plan operations and retries; dynamic agent calls remain budget-limited; external BYOA usage stays « inconnu ».
export function estimatePlan({ workflow, simulated }, pricing, { browserActionsMax = 0 } = {}) {
  // Each tool step counts as one platform tool call; anything else (network data requests, browser
  // actions…) comes from the step's own declared `estimate` — billing knows no pack-specific tool.
  const counts = { workflow_run: 1 };
  for (const s of workflow?.steps ?? []) {
    const attempts = s.effect === 'write' ? 1 : 1 + (s.retries ?? 0);
    if (s.kind === 'tool') counts.tool_call = (counts.tool_call ?? 0) + attempts;
    for (const [meter, units] of Object.entries(s.estimate ?? {})) {
      if (!Object.hasOwn(meters, meter)) throw new Error(`Estimation : mètre inconnu ${meter}`);
      counts[meter] = (counts[meter] ?? 0) + units * attempts;
    }
  }
  if (browserActionsMax) counts.browser_action = browserActionsMax;
  const lines = Object.entries(counts).map(([dimension, units]) => ({ dimension, units }));
  const priced = lines.map((l) => ({ ...l, cents: priceOf(l.dimension, l.units, pricing) }));
  const agentSteps =
    (workflow?.steps ?? []).filter((s) => s.kind === 'agent').length || (workflow ? 0 : 1);
  return {
    currency: pricing.currency,
    platformCentsMax: priced.reduce((n, l) => n + l.cents, 0),
    lines: priced,
    external: simulated
      ? 'Aucun modèle appelé'
      : `${agentSteps} tour(s) d’agent BYOA : consommation de votre fournisseur, inconnue et non refacturée`,
  };
}

export function summarize(entries) {
  const by = Object.create(null);
  for (const e of entries) {
    const m = Object.hasOwn(meters, e.dimension)
      ? meters[e.dimension]
      : { category: e.dimension, billable: true };
    const k = e.dimension;
    by[k] ??= {
      dimension: k,
      category: m.category,
      billable: m.billable,
      units: 0,
      platformCents: 0,
    };
    by[k].units += e.units ?? 0;
    by[k].platformCents += e.platform_cents ?? 0;
  }
  return Object.values(by);
}
