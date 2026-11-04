// Permanent rule of doubt, owner's decision: the prompt decides what is done, the Skill how. When
// neither settles which of several equivalent tools or methods to use, the agent asks instead of
// picking one at random. It is a choice rule, never an approval step: it adds no confirmation to
// browser actions. Defined here only; every mission prompt gets it through `withDoubtRule`.
export const DOUBT_RULE =
  'Règle de doute : suis d’abord le prompt, puis le Skill. S’ils ne tranchent pas entre plusieurs outils ou méthodes équivalents, ou s’il manque une information indispensable, pose la question par le formulaire de question de ton agent (AskUserQuestion / elicitation ACP) ou, sans formulaire, par le champ JSON question de ta réponse, et attends : la mission reste ouverte dans la même session ; ne choisis pas au hasard. Ne demande rien de ce que le prompt ou le Skill tranchent déjà : ce doute porte sur le choix de l’outil ou de la méthode, jamais sur l’autorisation d’une action que le prompt demande.';

export const withDoubtRule = (instructions) => `${instructions.trimEnd()} ${DOUBT_RULE}`;
