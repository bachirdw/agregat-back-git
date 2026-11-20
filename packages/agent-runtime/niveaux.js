// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/types.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/be/model-tier-resolution.ts
// swarm-16 : the model tiers of a sub-mission (leger, standard, fort), resolved against the models an
// agent announces. Pure functions, no dependency, never an exception. No model nor agent name here :
// the patterns of each tier come with the profile (`profil.niveaux`, packages/agent-runtime/profiles.js),
// and they only choose among the models the agent announces (its probe) : a tier that matches none
// falls back on today's rule, never a refusal.

// src/types.ts:91 (ModelTierSchema, four portable tiers smol, regular, smart, ultra) : three here.
export const NIVEAUX = ['leger', 'standard', 'fort'];

const sansAccents = (value) => value.normalize('NFD').replace(/[̀-ͯ]/g, '');

// src/types.ts:210-216 (parseModelTier) : trimmed, lower case ; anything else is no tier (null).
// The legacy shortnames of swarm (haiku→smol …) are model names : not kept (see NOTES.md).
export function parseNiveau(value) {
  if (typeof value !== 'string') return null;
  const normalized = sansAccents(value.trim().toLowerCase());
  return NIVEAUX.includes(normalized) ? normalized : null;
}

// The patterns a profile declares for a tier : non-empty strings only, in lower case.
function motifs(profil, niveau) {
  const table = profil && typeof profil === 'object' ? profil.niveaux : null;
  if (!table || typeof table !== 'object' || Array.isArray(table)) return [];
  const list = Object.hasOwn(table, niveau) ? table[niveau] : null;
  if (!Array.isArray(list)) return [];
  return list
    .filter((motif) => typeof motif === 'string' && motif.trim())
    .map((motif) => motif.trim().toLowerCase());
}

// The id of an announced model : a string, or an object of the probe ({ id, name }).
function idDe(model) {
  if (typeof model === 'string') return model.trim() || null;
  if (model && typeof model === 'object' && typeof model.id === 'string')
    return model.id.trim() || null;
  return null;
}

// niveauDe(modelId, profil) : the tier of a model id for that profile, or null. When patterns of
// several tiers are in the id (« pro » and « pro-max »…), the longest pattern wins (the most precise) ;
// at equal length, the first tier of NIVEAUX.
export function niveauDe(modelId, profil) {
  if (typeof modelId !== 'string' || !modelId.trim()) return null;
  const id = modelId.trim().toLowerCase();
  let best = null;
  let length = 0;
  for (const niveau of NIVEAUX)
    for (const motif of motifs(profil, niveau))
      if (id.includes(motif) && motif.length > length) {
        best = niveau;
        length = motif.length;
      }
  return best;
}

// modelePour(niveau, profil, modelesAnnonces) : the first announced model (in the order the agent
// announces them) whose id contains a pattern of that tier, and whose tier is that one (niveauDe :
// modelePour and niveauDe never disagree) ; null otherwise (unknown tier, profile without `niveaux`,
// nothing announced, nothing matching).
export function modelePour(niveau, profil, modelesAnnonces) {
  const tier = parseNiveau(niveau);
  if (!tier || !Array.isArray(modelesAnnonces) || !motifs(profil, tier).length) return null;
  for (const model of modelesAnnonces) {
    const id = idDe(model);
    if (id && niveauDe(id, profil) === tier) return id;
  }
  return null;
}

// src/be/model-tier-resolution.ts:8-23 (precedence, first hit wins) and :352-371
// (taskModelCandidates), adapted to Relay's launch() (plan, swarm-16, DJ) :
//   1. `modele` given (a string, '' included : today `args.modele ?? …` takes '' as « the agent's
//      default ») → source « modele » ; never checked here : the « Modèle non annoncé » check of the
//      engine stays its only judge (model-tier-resolution.ts:496-508 : only a model the task pinned
//      fails, a tier never does) ;
//   2. `niveau` given → its model, source « niveau » ;
//   3. `precedent` (the model of the previous attempt, for a resumption or a suite ; the caller gives
//      it only when the agent stays the same) → source « precedent » ;
//   4. `niveauRole` (the tier of the role's file) → its model, source « role » ;
//   5. `defaut` (today's rule, computed by the caller) → source « defaut ».
// A tier that does not resolve does not fall to the next layer : it goes to today's rule (plan :
// « Un niveau qui ne se résout pas → règle d'aujourd'hui »), with `nonReconnu` (the tier) and
// `depuis` (« niveau » or « role ») : the caller writes the sentence of delegation-rule.js in its
// note (texts given to agents live there). Returns { modele, source, niveau?, nonReconnu?, depuis? } ;
// `niveau` is the tier of the model chosen, when known.
export function choisirModele(options) {
  const {
    modele,
    niveau,
    precedent,
    niveauRole,
    defaut = '',
    profil = null,
    modelesAnnonces = [],
  } = options && typeof options === 'object' ? options : {};
  const fallback = typeof defaut === 'string' ? defaut : '';
  const avecNiveau = (choice) => {
    const tier = niveauDe(choice.modele, profil);
    return tier ? { ...choice, niveau: tier } : choice;
  };
  if (typeof modele === 'string') return avecNiveau({ modele: modele.trim(), source: 'modele' });
  const resolve = (asked, source) => {
    const tier = parseNiveau(asked);
    if (!tier) return null;
    const found = modelePour(tier, profil, modelesAnnonces);
    return found
      ? { modele: found, source, niveau: tier }
      : avecNiveau({ modele: fallback, source: 'defaut', nonReconnu: tier, depuis: source });
  };
  const asked = resolve(niveau, 'niveau');
  if (asked) return asked;
  if (typeof precedent === 'string') return avecNiveau({ modele: precedent, source: 'precedent' });
  const fromRole = resolve(niveauRole, 'role');
  if (fromRole) return fromRole;
  return avecNiveau({ modele: fallback, source: 'defaut' });
}

// For agents() / mission_suivre : the tier of each announced model, only when it is known.
export const avecNiveaux = (modeles, profil) =>
  (Array.isArray(modeles) ? modeles : []).map((model) => {
    const tier = model && typeof model === 'object' ? niveauDe(model.id, profil) : null;
    return tier ? { ...model, niveau: tier } : model;
  });
