// Owner questions asked by the agent through ACP form elicitation (`elicitation/create`).
// The schema is flat (ACP spec): primitive properties, string enums (`enum` or titled `oneOf`),
// number/integer/boolean, and string arrays whose items are an enum (`enum` or titled `anyOf`).

const MAX_MESSAGE = 8000;
const MAX_SCHEMA_BYTES = 100000;

export class AnswerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AnswerError';
    this.code = 'invalid_answer';
  }
}

const optionValues = (list) =>
  Array.isArray(list) ? list.map((o) => (o && typeof o === 'object' ? o.const : undefined)) : null;

const allowedOf = (schema) => schema.enum ?? optionValues(schema.oneOf) ?? null;

// Public, bounded copy of what the agent asked: the front renders it, the API validates against it.
export function publicQuestion(id, params, askedAt) {
  const requestedSchema = params.requestedSchema;
  if (!requestedSchema || typeof requestedSchema !== 'object' || Array.isArray(requestedSchema))
    return null;
  if (Buffer.byteLength(JSON.stringify(requestedSchema)) > MAX_SCHEMA_BYTES) return null;
  return {
    id,
    kind: 'form',
    message: String(params.message ?? '').slice(0, MAX_MESSAGE),
    requestedSchema,
    toolCallId: params.toolCallId ?? null,
    askedAt,
  };
}

// Question carried by the agent's JSON answer (`question: {message, options?}`), for agents with no
// form elicitation. One free-text field `reponse`; the options are suggestions shown to the owner
// (`examples`), never a closed list: the owner may answer anything.
export const MAX_ANSWER = 12000;
export function proseQuestion(id, question, askedAt) {
  const options = question.options ?? [];
  return {
    id,
    kind: 'prose',
    message: String(question.message).slice(0, MAX_MESSAGE),
    options,
    requestedSchema: {
      type: 'object',
      properties: {
        reponse: {
          type: 'string',
          title: 'Réponse',
          minLength: 1,
          maxLength: MAX_ANSWER,
          ...(options.length ? { examples: options } : {}),
        },
      },
      required: ['reponse'],
    },
    toolCallId: null,
    askedAt,
  };
}

function checkField(key, schema, value) {
  const fail = (why) => {
    throw new AnswerError(`Champ « ${key} » invalide : ${why}`);
  };
  switch (schema.type) {
    case 'string': {
      if (typeof value !== 'string') fail('texte attendu');
      const allowed = allowedOf(schema);
      if (allowed && !allowed.includes(value)) fail('valeur hors des choix proposés');
      if (Number.isInteger(schema.minLength) && value.length < schema.minLength)
        fail(`au moins ${schema.minLength} caractères`);
      if (Number.isInteger(schema.maxLength) && value.length > schema.maxLength)
        fail(`au plus ${schema.maxLength} caractères`);
      if (value.length > 20000) fail('texte trop long');
      return;
    }
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('nombre attendu');
      if (schema.type === 'integer' && !Number.isInteger(value)) fail('entier attendu');
      if (typeof schema.minimum === 'number' && value < schema.minimum)
        fail(`minimum ${schema.minimum}`);
      if (typeof schema.maximum === 'number' && value > schema.maximum)
        fail(`maximum ${schema.maximum}`);
      return;
    }
    case 'boolean':
      if (typeof value !== 'boolean') fail('booléen attendu');
      return;
    case 'array': {
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
        fail('liste de textes attendue');
      const allowed = schema.items ? (schema.items.enum ?? optionValues(schema.items.anyOf)) : null;
      if (allowed && value.some((item) => !allowed.includes(item)))
        fail('valeur hors des choix proposés');
      if (Number.isInteger(schema.minItems) && value.length < schema.minItems)
        fail(`au moins ${schema.minItems} choix`);
      if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems)
        fail(`au plus ${schema.maxItems} choix`);
      return;
    }
    default:
      fail('type de champ non pris en charge');
  }
}

// Returns the validated content; throws AnswerError otherwise.
export function validateContent(requestedSchema, content) {
  if (!content || typeof content !== 'object' || Array.isArray(content))
    throw new AnswerError('content doit être un objet');
  const properties = requestedSchema?.properties ?? {};
  for (const key of Object.keys(content))
    if (!Object.hasOwn(properties, key)) throw new AnswerError(`Champ inconnu : ${key}`);
  for (const key of requestedSchema?.required ?? [])
    if (content[key] === undefined) throw new AnswerError(`Champ obligatoire manquant : ${key}`);
  for (const [key, value] of Object.entries(content)) checkField(key, properties[key] ?? {}, value);
  return content;
}
