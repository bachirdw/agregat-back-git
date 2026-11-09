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

// bilan-06 (E52) : a turn that ends by asking the owner to decide, in prose with no form and no
// `question` field, is a question all the same. The last paragraph is the question when it asks
// (« dis-moi », « veux-tu », « voulez-vous », « lesquel(le)s » en tête de phrase, « préfères-tu », « souhaites-tu »,
// « do you want », « would you like », « which one(s) », or a final « ? »). The agent's own words,
// nothing rephrased; no options, the owner answers freely.
const ASKS =
  /(?:^|[^\p{L}])(?:dis[-‑ ]?moi|dites[-‑ ]?moi|veux[-‑ ]?tu|voulez[-‑ ]?vous|prefere[sz][-‑ ]?(?:tu|vous)|souhaite[sz][-‑ ]?(?:tu|vous)|do you want|would you like|which one(?:s)?|let me know which|tell me which|(?:me|nous) (?:dire|indiquer|confirmer) si|confirme[sz]?[-‑ ]?moi|let me know (?:if|whether) (?:you want|i should)|should i)(?![\p{L}])/iu;
// Audit du 10/11 (constat 4) : « lequel / laquelle / lesquel(le)s » ask only when they open the
// sentence (« Laquelle traiter ? ») ; inside it they are mostly relatives (« l'offre à laquelle tu
// voulais candidater ») and asked nothing.
const ASKING_PRONOUN = /^(?:lesquel(?:le)?s?|laquelle|lequel)(?![\p{L}])/iu;
// A courtesy sentence offers more help and asks for no decision (« Dis-moi si tu veux autre chose »,
// « Would you like me to also save it? », « Let me know if you need anything else ») : it is left
// out before the paragraph is read as a question. Relecture du 10/11 (constat 2) : a sentence that
// proposes an action with consequences (submit, send, apply, click, attach…) or a choice
// (« … ou … ? ») is never courtesy, even with « aussi », « autre chose » or « dis-moi si tu veux ».
// The text is read without accents (NFD).
const COURTESY =
  /(?:(?:dis|dites)[-‑ ]?moi si (?:tu|vous) (?:veux|voulez|souhaite[sz]?|as|avez|aimerais|aimeriez)|let me know if you|n['’]h[e]site[sz]? pas|(?:veux|voulez|souhaite[sz]?)(?:[-‑ ]?(?:tu|vous))?\s+(?:(?:encore|quelque)\s+)?autre chose|besoin d['’]\s*(?:encore\s+)?autre chose|(?:pour|avec|sur) (?:autre chose|quoi que ce soit)|quoi que ce soit d['’]autre|anything else|feel free|(?:je reste|reste) a (?:ta|votre) disposition|(?:would you like|do you want|veux[-‑ ]?tu|voulez[-‑ ]?vous|souhaite[sz][-‑ ]?(?:tu|vous))(?![\p{L}])[^.?!]*(?:^|[^\p{L}])(?:aussi|egalement|also|as well)(?![\p{L}]))/iu;
const PROPOSED_ACTION =
  /(?:^|[^\p{L}])(?:soumet\p{L}*|soumis|soumettre|envoi\p{L}*|envoy\p{L}*|j['’]envoie|postul\p{L}*|candidat(?:er|ez)|cliqu\p{L}*|joign\p{L}*|joindre|joins|rempli(?:r|sse|sses|ssiez)|publi(?:e|er|es|ez)|supprim\p{L}*|pay(?:e|er|ez)|achet\p{L}*|televers\p{L}*|submit\p{L}*|send(?:ing)?|apply(?:ing)?|click\p{L}*|attach\p{L}*|fill(?:ing)?|publish\p{L}*|upload\p{L}*|delete|purchase)(?![\p{L}])/iu;
const OFFERS_CHOICE =
  /(?:^|[^\p{L}])(?:prefere[sz]?|prefer|plutot|rather|veux[-‑ ]?tu|voulez[-‑ ]?vous|souhaite[sz][-‑ ]?(?:tu|vous)|(?:dis|dites)[-‑ ]?moi si (?:tu|vous) (?:veux|voulez)|would you|do you want|should i|dois[-‑ ]?je)(?![\p{L}])[^.?!]*(?:^|[^\p{L}])(?:ou|or)(?![\p{L}])/iu;
const isCourtesy = (sentence) =>
  COURTESY.test(sentence) && !PROPOSED_ACTION.test(sentence) && !OFFERS_CHOICE.test(sentence);
export function decisionRequest(summary) {
  if (typeof summary !== 'string') return null;
  const last = summary
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .at(-1);
  if (!last) return null;
  const plain = last.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const sentences = plain
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !isCourtesy(sentence));
  if (!sentences.length) return null;
  const end = sentences.at(-1).replace(/[\s*_`"'»)\]]+$/u, '');
  if (
    !end.endsWith('?') &&
    !sentences.some((sentence) => ASKS.test(sentence) || ASKING_PRONOUN.test(sentence))
  )
    return null;
  return { message: last.slice(0, MAX_MESSAGE) };
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
