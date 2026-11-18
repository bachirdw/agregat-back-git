// questions-18-11 (E126) : how an agent asks the owner a question, the same sentence for every agent
// and every pack. Defined here only ; every instruction that speaks of a question to the owner quotes
// it (career-ops pack, browser missions, and every other mission through `withDoubtRule`).
// Real trials of 18/11 : without the exact format of the `question` field an agent with no form made
// one up or wrote that it was waiting, and nothing was asked ; with the format, the question opened.
// precision-18-11 (E130) : a question tool that returns at once, without waiting for the answer, is
// not a question form. An agent whose only question tool works that way took it for "its agent's
// form" ; nothing came back to the platform and the owner was never asked. Real trial of 18/11 with
// this sentence : the agent with only such a tool asked through the JSON `question` field, the agent
// with a real form kept its form. It clarifies what a form is ; it forbids no tool.
// review-precision-18-11 : the sentence names no agent and no agent's tool (owner's rule : the same
// words for every agent), so the form is named by the common protocol only (ACP elicitation) ; the
// precision keeps the exact words of the real trial (« … champ JSON question de ta réponse »).
export const OWNER_QUESTION_RULE =
  'Règle des questions : pour poser une question au propriétaire, utilise le formulaire de question de ton agent (elicitation ACP) s’il t’en offre un ; sinon termine ta réponse JSON par le champ question au format exact {"question":{"message":"…","options":["…","…"]}} (message obligatoire, options facultatives). Un outil de question qui rend la main tout de suite, sans attendre la réponse, n’est pas un formulaire de question : si c’est le seul que tu as, pose ta question par le champ JSON question de ta réponse. Dans les deux cas, la mission attend la réponse du propriétaire dans la même session. Si tu attends une réponse du propriétaire, pose ta question par l’une de ces deux voies : c’est ce qui met la mission en attente.';
