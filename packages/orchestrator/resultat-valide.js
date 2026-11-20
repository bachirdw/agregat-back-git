// swarm-10 (plan swarm du 20/11) : the result of a sub-mission in the shape its chief asked for.
// - `mission_lancer.schemaResultat` : checked at launch (launchErrors, synchronous, before any folder
//   or counter of launch()) ; kept in the brief and in `<dossierResultats>/schema-resultat.json` (read
//   again after a restart, and inherited by a suite or a resumption that gives none) ;
// - the tool `resultat_rendre` (server `relay-equipe`, lent to every sub-mission with the notebook) :
//   a result that does not fit is refused at once with the errors and the expected shape, while the
//   sub-mission still works ; a valid one is written in its results folder (`resultat.json`, or
//   `verdict.json` for a verification role, whose shape is VERDICT_SCHEMA), kept in memory and said
//   by an event `resultat_rendu { childId }` on the mother (never its content) ; the last valid call
//   replaces the previous one ;
// - `of(child)` : what the chief gets in `terminees[].resultat`, already parsed.
// The tool is optional : a sub-mission that never calls it ends as today ; the chief sees
// `{ valide: false }` only when a shape was asked. call() and of() never throw.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readConfined, writeConfined } from '../policy-engine/files.js';
import { terminal } from '../storage/index.js';
import { RESULT_TOOLS } from './delegation-rule.js';
import { MAX_VERDICT_BYTES } from './roles.js';
import {
  MAX_ERRORS,
  findShapeErrors,
  invalidMessage,
  isEffectiveSchema,
  validateJsonSchema,
  validationError,
} from './schema-resultat.js';

// The longest result taken by the tool (its JSON text). The internal route of the platform bounds
// the body of a call more tightly (apps/api/server.js) : that bound is the one that applies.
export const MAX_RESULT_CHARS = 200000;
const MAX_RESULT_BYTES = 1000000;
const MAX_SCHEMA_BYTES = 256 * 1024;
export const RESULT_FILE = 'resultat.json';
export const SCHEMA_FILE = 'schema-resultat.json';
const VERDICT_FILE = 'verdict.json';

// The verdict of a verification role, given by the same tool (plan, word for word).
export const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict'],
  properties: {
    verdict: { enum: ['approuve', 'a_corriger', 'rejete'] },
    bloquants: { type: 'array', items: { type: 'object', required: ['ou', 'pourquoi'] } },
    remarques: { type: 'array', items: { type: 'string' } },
  },
};
// Same rule as normalizeVerdict (roles.js, swarm-04) : its first 20 points, each `pourquoi` cut to
// 500 characters then trimmed.
const IMPRECISE = new Set(['a_corriger', 'rejete']);
const VERDICT_ITEMS = 20;
const VERDICT_FIELD = 500;

const fail = (erreur, message) => Object.assign(new Error(message), { erreur });
const folderOf = (run) =>
  typeof run?.famille?.dossierResultats === 'string' && run.famille.dossierResultats
    ? run.famille.dossierResultats.replace(/\/+$/, '')
    : null;
const textOf = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// The errors of a verdict : its shape, then the rule the schema cannot say (« a_corriger » or
// « rejete » needs at least one blocking point whose `pourquoi` is not empty). Empty : valid.
export function verdictErrors(value) {
  const errors = validateJsonSchema(VERDICT_SCHEMA, value);
  if (errors.length) return errors;
  const precise = (Array.isArray(value.bloquants) ? value.bloquants : [])
    .slice(0, VERDICT_ITEMS)
    .some((item) =>
      String(item?.pourquoi ?? '')
        .slice(0, VERDICT_FIELD)
        .trim(),
    );
  if (IMPRECISE.has(value.verdict) && !precise)
    errors.push(
      `racine : un verdict ${value.verdict} demande au moins un point bloquant (bloquants : [{ ou, pourquoi }]) dont pourquoi n’est pas vide`,
    );
  return errors;
}

// The errors of a schema given at launch : its shape (swarm's check), and its root, which must
// describe an object (resultat_rendre takes an object). Empty : valid.
export function launchErrors(schema) {
  const errors = findShapeErrors(schema);
  if (!errors.length && schema.type !== undefined && schema.type !== 'object')
    errors.push(
      `schemaResultat.type : le résultat rendu par resultat_rendre est un objet : la racine doit être de type « object » (ou sans type), reçu « ${String(schema.type).slice(0, 40)} »`,
    );
  return errors;
}

export class ResultatValide {
  constructor(delegation) {
    this.delegation = delegation;
    this.kept = new Map(); // sub-mission id -> its last valid result (memory)
    this.refused = new Map(); // sub-mission id -> the errors of its last refused result
  }
  get store() {
    return this.delegation.store;
  }
  // A verification role (the row's mark, kept after a restart).
  verifier(run) {
    return run?.famille?.verdictAttendu === true;
  }
  // The schema the chief gave (or the task inherited) : the brief, else the folder's file.
  given(run) {
    const kept = this.delegation.briefs?.get(run?.id)?.schemaResultat;
    if (isEffectiveSchema(kept)) return kept;
    return this.readSchema(run?.cwd, folderOf(run));
  }
  // The shape a result of `run` must have : the verdict's for a verification role, else the one
  // given by the chief, else null.
  schemaOf(run) {
    try {
      if (!run?.famille) return null;
      return this.verifier(run) ? VERDICT_SCHEMA : this.given(run);
    } catch {
      return null;
    }
  }

  // ---- launch (delegation.js launch() and briefs)

  // The schema of a sub-mission being launched : the one given (checked : a refusal throws
  // `parametres_invalides`), {} meaning none ; without one, the schema of the task it resumes or
  // continues. Synchronous ; creates nothing.
  schemaForLaunch(args, previous) {
    if (args?.schemaResultat !== undefined) {
      if (!isEffectiveSchema(args.schemaResultat)) return null;
      const errors = launchErrors(args.schemaResultat);
      if (errors.length)
        throw fail(
          'parametres_invalides',
          `schemaResultat mal écrit : ${errors.slice(0, 5).join(' ; ')}`,
        );
      return args.schemaResultat;
    }
    return previous ? this.given(previous) : null;
  }
  // Reads `<folder>/schema-resultat.json` : null when absent, unreadable, too big or malformed.
  readSchema(cwd, folder) {
    if (!cwd || !folder) return null;
    try {
      const file = `${folder.replace(/\/+$/, '')}/${SCHEMA_FILE}`;
      if (!existsSync(join(cwd, file))) return null;
      const schema = JSON.parse(readConfined(cwd, file, MAX_SCHEMA_BYTES).toString('utf8'));
      return isEffectiveSchema(schema) && !launchErrors(schema).length ? schema : null;
    } catch {
      return null;
    }
  }
  // Writes the schema in the results folder (to survive a restart) ; false when it cannot.
  writeSchema(cwd, folder, schema) {
    if (!cwd || !folder || !isEffectiveSchema(schema)) return false;
    try {
      writeConfined(cwd, `${folder.replace(/\/+$/, '')}/${SCHEMA_FILE}`, JSON.stringify(schema));
      return true;
    } catch {
      return false;
    }
  }

  // ---- the tool (Delegation.call, its token already checked ; `run` is the calling execution)

  call(run, control, body) {
    try {
      if (!run?.famille)
        return { status: 403, body: { error: 'Outil resultat_rendre réservé aux sous-missions' } };
      const parsed = RESULT_TOOLS.resultat_rendre.schema.safeParse(body?.args ?? {});
      if (!parsed.success)
        return {
          status: 200,
          body: {
            erreur: 'parametres_invalides',
            message: parsed.error.issues
              .slice(0, 5)
              .map((issue) => `${issue.path.join('.') || 'arguments'} — ${issue.message}`)
              .join(' ; '),
          },
        };
      control?.toolDelivered?.(null, 'gateway');
      const value = parsed.data.resultat;
      const text = textOf(value);
      const verifier = this.verifier(run);
      let errors = null;
      let message;
      if (text === undefined) message = 'Résultat illisible : rends un objet JSON.';
      else if (text.length > MAX_RESULT_CHARS)
        message = `résultat trop long : ${text.length} caractères (${MAX_RESULT_CHARS} au plus) : mets le détail dans un fichier de ton dossier de résultats et rends-en le chemin.`;
      else if (verifier && Buffer.byteLength(text) > MAX_VERDICT_BYTES)
        message = `verdict trop long : ${Buffer.byteLength(text)} octets (${MAX_VERDICT_BYTES} au plus) : raccourcis bloquants et remarques, puis rappelle resultat_rendre.`;
      else if (verifier) {
        errors = verdictErrors(value);
        if (errors.length) message = invalidMessage(errors, VERDICT_SCHEMA);
      } else {
        const schema = this.given(run);
        message = schema ? validationError(schema, value) : undefined;
        if (message) {
          const shape = findShapeErrors(schema);
          errors = shape.length ? shape : validateJsonSchema(schema, value);
        }
      }
      if (message) {
        this.refused.set(run.id, (errors?.length ? errors : [message]).slice(0, MAX_ERRORS));
        return { status: 200, body: { erreur: 'resultat_invalide', message } };
      }
      // Valid : written in the results folder (confined), kept, said without its content.
      const folder = folderOf(run);
      let written = false;
      if (folder)
        try {
          writeConfined(run.cwd, `${folder}/${verifier ? VERDICT_FILE : RESULT_FILE}`, text);
          written = true;
        } catch {
          /* Kept in memory only. */
        }
      this.kept.set(run.id, value);
      this.refused.delete(run.id);
      try {
        this.store.event(run.famille.mere, 'resultat_rendu', { childId: run.id });
      } catch {
        /* The result stays accepted. */
      }
      return {
        status: 200,
        body: {
          result: written
            ? { accepte: true }
            : {
                accepte: true,
                note: verifier
                  ? 'Verdict accepté mais non écrit dans ton dossier de résultats : rappelle-le aussi dans ta réponse finale par la ligne « Verdict : … ».'
                  : 'Résultat accepté mais non écrit dans ton dossier de résultats : il est gardé par la plateforme jusqu’à son redémarrage.',
              },
        },
      };
    } catch {
      return {
        status: 200,
        body: { erreur: 'erreur', message: 'Résultat non enregistré : rappelle resultat_rendre.' },
      };
    }
  }

  // ---- what the chief gets (outcome() of delegation.js)

  // `{ valide: true, valeur }`, `{ valide: false, erreurs }` or null. A verification role's verdict
  // travels as `verdict` (verdictOf) : null here. Memory first, else the file written while the
  // sub-mission ran (as readVerdict) ; once ended, a missing result is said only when a shape was
  // asked.
  of(child) {
    try {
      if (!child?.famille || this.verifier(child)) return null;
      if (this.kept.has(child.id)) return { valide: true, valeur: this.kept.get(child.id) };
      const schema = this.given(child);
      const read = this.readResult(child);
      if (read !== undefined) {
        const errors = schema ? validateJsonSchema(schema, read) : [];
        return errors.length
          ? { valide: false, erreurs: errors.slice(0, MAX_ERRORS) }
          : { valide: true, valeur: read };
      }
      if (!schema || !terminal.has(child.state)) return null;
      return { valide: false, erreurs: this.refused.get(child.id) ?? ['aucun résultat rendu'] };
    } catch {
      return null;
    }
  }
  // The result file of this execution : written between its start and its end (a suite shares the
  // folder of the attempt it continues) ; undefined otherwise.
  readResult(child) {
    const folder = folderOf(child);
    if (!child.cwd || !folder || !child.startedAt) return undefined;
    try {
      const file = `${folder}/${RESULT_FILE}`;
      const written = statSync(join(child.cwd, file)).mtimeMs;
      if (written < Date.parse(child.startedAt)) return undefined;
      if (child.finishedAt && written > Date.parse(child.finishedAt)) return undefined;
      const value = JSON.parse(readConfined(child.cwd, file, MAX_RESULT_BYTES).toString('utf8'));
      return isObject(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }
}
