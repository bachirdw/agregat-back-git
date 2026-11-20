// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/workflows/json-schema-validator.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/utils/output-schema.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/tasks/terminal-result-guard.ts
// Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh) : src/tools/send-task.ts
// swarm-10 : the shape a sub-mission's result must have (schemaResultat), checked by a small
// hand-written JSON Schema validator. Pure : no import, nothing read nor written, never throws.
//
// Supported keywords (the subset of swarm) :
// - `type` : "object", "string", "number", "boolean", "array" (another value : not checked)
// - `required` : names of the properties that must be present (objects only)
// - `properties` : name -> schema (recursive, only for the properties present)
// - `enum` : allowed values (compared by JSON text)
// - `const` : the one allowed value (compared by JSON text)
// - `items` : schema of every element of an array (recursive)
// Any other keyword (`oneOf`, `anyOf`, `$ref`, `pattern`, `format`, `additionalProperties`…) is
// silently ignored : say so wherever the agents are told what they may write.

// Relay's bounds (not in swarm) : a schema deeper than this is refused by findShapeErrors (no stack
// overflow), and the texts given back to the agent stay short.
export const MAX_SCHEMA_DEPTH = 32;
export const MAX_ERRORS = 20;
export const MAX_VALUE_CHARS = 200;
export const MAX_SCHEMA_CHARS = 4000;
// Relay (relecture) : one error given back, at most (a key name can be very long).
export const MAX_ERROR_CHARS = 300;

const typeOf = (data) => {
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';
  if (Array.isArray(data)) return 'array';
  return typeof data;
};
const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
// Relay : own properties only (swarm's `key in obj` takes « toString » or « constructor » as
// present on every object).
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const clip = (text, max) => {
  const value = String(text);
  return value.length > max ? value.slice(0, max) + '…' : value;
};
const json = (value) => {
  try {
    return clip(JSON.stringify(value), MAX_VALUE_CHARS);
  } catch {
    return typeOf(value);
  }
};
const same = (a, b) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

function matchesType(expected, data) {
  switch (expected) {
    case 'string':
      return typeof data === 'string';
    case 'number':
      return typeof data === 'number';
    case 'boolean':
      return typeof data === 'boolean';
    case 'array':
      return Array.isArray(data);
    case 'object':
      return isPlainObject(data);
    default:
      return true; // Unknown type : don't block.
  }
}

function validate(schema, data, path, errors) {
  const prefix = path || 'racine';
  // Relay : the trap of swarm. Its validator reads `schema.type` of every nested schema : with
  // `{ properties: { a: null } }` and a value that has `a`, it throws (null.type). findShapeErrors
  // refuses such a schema at launch ; here, a nested schema that is not an object is an error.
  if (!isPlainObject(schema)) {
    errors.push(`${prefix} : forme mal écrite (schéma attendu, reçu ${typeOf(schema)})`);
    return;
  }

  // Type check.
  if (schema.type !== undefined) {
    const expected = schema.type;
    if (!matchesType(expected, data)) {
      errors.push(`${prefix} : type attendu « ${expected} », reçu ${typeOf(data)}`);
      return; // No point checking the properties of a wrong type.
    }
  }

  // Required fields (objects only).
  if (Array.isArray(schema.required) && typeof data === 'object' && data !== null)
    for (const key of schema.required)
      if (!has(data, key)) errors.push(`${prefix} : propriété requise absente « ${key} »`);

  // Enum check.
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((value) => same(value, data))) {
      errors.push(
        `${prefix} : valeur ${json(data)} hors des valeurs permises [${schema.enum.map(json).join(', ')}]`,
      );
      return;
    }
  }

  // Const check.
  if (has(schema, 'const')) {
    if (!same(data, schema.const)) {
      errors.push(
        `${prefix} : valeur ${json(data)} différente de la valeur imposée ${json(schema.const)}`,
      );
      return;
    }
  }

  // Recursive property validation (objects only).
  if (isPlainObject(schema.properties) && typeof data === 'object' && data !== null)
    for (const [key, subSchema] of Object.entries(schema.properties))
      if (has(data, key)) validate(subSchema, data[key], path ? `${path}.${key}` : key, errors);

  // Items validation (arrays).
  if (typeof schema.items === 'object' && schema.items !== null && Array.isArray(data))
    for (let i = 0; i < data.length; i++)
      validate(schema.items, data[i], `${prefix}[${i}]`, errors);
}

// The errors of `data` against `schema` (empty : valid). Port of swarm's validateJsonSchema.
export function validateJsonSchema(schema, data) {
  const errors = [];
  validate(schema, data, '', errors);
  return errors;
}

// Checks that a candidate schema uses only the shape validateJsonSchema can read : every nested
// schema under `properties` / `items` is itself an object. A schema that passes this check can
// never make the validator fail (swarm : `{ properties: { answer: null } }` reading `null.type`).
// Returns the errors naming the faulty path (empty : valid). Port of findJsonSchemaShapeErrors.
export function findShapeErrors(schema, path = 'schemaResultat', depth = 0) {
  const errors = [];

  if (!isPlainObject(schema)) {
    errors.push(`${path} : doit être un schéma JSON (un objet), reçu ${typeOf(schema)}`);
    return errors;
  }
  // Relay : a bounded depth (swarm has none : a very deep schema would overflow the stack).
  if (depth >= MAX_SCHEMA_DEPTH) {
    errors.push(`${path} : schéma trop profond (${MAX_SCHEMA_DEPTH} niveaux au plus)`);
    return errors;
  }

  if (schema.type !== undefined && typeof schema.type !== 'string')
    errors.push(`${path}.type : doit être un texte, reçu ${typeOf(schema.type)}`);

  if (
    schema.required !== undefined &&
    (!Array.isArray(schema.required) || !schema.required.every((v) => typeof v === 'string'))
  )
    errors.push(`${path}.required : doit être une liste de textes`);

  if (schema.enum !== undefined && !Array.isArray(schema.enum))
    errors.push(`${path}.enum : doit être une liste`);

  if (schema.properties !== undefined) {
    if (!isPlainObject(schema.properties))
      errors.push(
        `${path}.properties : doit être un objet qui donne le schéma de chaque propriété`,
      );
    else
      for (const [key, value] of Object.entries(schema.properties))
        errors.push(...findShapeErrors(value, `${path}.properties.${key}`, depth + 1));
  }

  if (schema.items !== undefined)
    errors.push(...findShapeErrors(schema.items, `${path}.items`, depth + 1));

  return errors;
}

// Port of output-schema.ts. An explicit empty schema (`{}`) means « no schema ». swarm : callers
// pass it on purpose to stop a child task from inheriting the parent's schema ; it must never reach
// an agent as a contract : told to return JSON matching `{}`, a worker ends with the literal output
// "{}" and drops its real result.
export function isEffectiveSchema(schema) {
  return isPlainObject(schema) && Object.keys(schema).length > 0;
}
// The schema when it is effective, otherwise undefined.
export function normalizeSchema(schema) {
  return isEffectiveSchema(schema) ? schema : undefined;
}

// The texts given back to the sub-mission (the first one word for word from the plan).
const shown = (schema) => {
  try {
    return clip(JSON.stringify(schema), MAX_SCHEMA_CHARS);
  } catch {
    return '(illisible)';
  }
};
export const invalidMessage = (errors, schema) => {
  const listed = errors
    .slice(0, MAX_ERRORS)
    .map((error) => clip(error, MAX_ERROR_CHARS))
    .join(' ; ');
  const more = errors.length > MAX_ERRORS ? ` ; et ${errors.length - MAX_ERRORS} autre(s)` : '';
  return `Le résultat ne respecte pas la forme demandée. Erreurs : ${listed}${more}. Forme attendue : ${shown(schema)}. Corrige et rappelle resultat_rendre.`;
};
export const MALFORMED_SCHEMA = (detail) =>
  `La forme demandée pour ton résultat est mal écrite et ne peut pas être vérifiée (${clip(detail, MAX_VALUE_CHARS)}) : rends ton résultat dans ta réponse finale ; l’agent principal le recevra sans vérification.`;

// Port of getTaskOutputValidationError : undefined when the value fits (or when there is no
// effective schema), otherwise the text to give back. Never throws. swarm's three cases :
// no output, output that is not JSON (here : a text value that does not parse), malformed schema.
export function validationError(schema, value) {
  if (!isEffectiveSchema(schema)) return undefined;

  if (value === undefined || value === null || value === '')
    return invalidMessage(['aucun résultat rendu'], schema);

  let parsed = value;
  if (typeof value === 'string')
    try {
      parsed = JSON.parse(value);
    } catch {
      return invalidMessage(['le résultat n’est pas un JSON lisible'], schema);
    }

  let errors;
  try {
    // swarm : a malformed schema should be refused at launch (shape check), but one that reached
    // here another way must give a normal error, never throw and leave the task hanging.
    const shape = findShapeErrors(schema);
    if (shape.length) return MALFORMED_SCHEMA(shape.slice(0, 3).join(' ; '));
    errors = validateJsonSchema(schema, parsed);
  } catch (error) {
    return MALFORMED_SCHEMA(error instanceof Error ? error.message : String(error));
  }
  return errors.length ? invalidMessage(errors, schema) : undefined;
}
