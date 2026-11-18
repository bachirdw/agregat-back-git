// questions-18-11 (E126) : how an agent asks the owner a question, the same sentence for every agent
// and every pack. Defined here only ; every instruction that speaks of a question to the owner quotes
// it (career-ops pack, browser missions, and every other mission through `withDoubtRule`).
// Real trials of 18/11 : without the exact format of the `question` field an agent with no form made
// one up or wrote that it was waiting, and nothing was asked ; with the format, the question opened.
export const OWNER_QUESTION_RULE =
  'Règle des questions : pour poser une question au propriétaire, utilise le formulaire de question de ton agent (AskUserQuestion / elicitation ACP) s’il t’en offre un ; sinon termine ta réponse JSON par le champ question au format exact {"question":{"message":"…","options":["…","…"]}} (message obligatoire, options facultatives). Dans les deux cas, la mission attend la réponse du propriétaire dans la même session. Si tu attends une réponse du propriétaire, pose ta question par l’une de ces deux voies : c’est ce qui met la mission en attente.';
