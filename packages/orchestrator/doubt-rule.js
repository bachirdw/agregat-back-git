import { OWNER_QUESTION_RULE } from './owner-question-rule.js';

// Permanent rule of doubt, owner's decision: the prompt decides what is done, the Skill how. When
// neither settles which of several equivalent tools or methods to use, the agent asks instead of
// picking one at random. It is a choice rule, never an approval step: it adds no confirmation to
// browser actions. Defined here only; every mission prompt gets it through `withDoubtRule`.
// questions-18-11 : how to ask is said once, by the common question rule (`OWNER_QUESTION_RULE`).
export const DOUBT_RULE =
  'Règle de doute : suis d’abord le prompt, puis le Skill. S’ils ne tranchent pas entre plusieurs outils ou méthodes équivalents, ou s’il manque une information indispensable, pose la question au propriétaire comme le dit la règle des questions, et attends : la mission reste ouverte dans la même session ; ne choisis pas au hasard. Ne demande rien de ce que le prompt ou le Skill tranchent déjà : ce doute porte sur le choix de l’outil ou de la méthode, jamais sur l’autorisation d’une action que le prompt demande.';

// The common question rule is added when the instructions do not quote it already : every mission
// prompt carries it exactly once.
export const withDoubtRule = (instructions) => {
  const base = instructions.trimEnd();
  const questionRule = base.includes(OWNER_QUESTION_RULE) ? '' : ` ${OWNER_QUESTION_RULE}`;
  return `${base}${questionRule} ${DOUBT_RULE}`;
};
