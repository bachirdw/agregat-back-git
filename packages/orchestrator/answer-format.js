// reponse-04 (front, BRIEF-conversation-reponse-04 du 21/11) : la réponse finale est surtout du texte,
// rendue en markdown par l'interface, avec un bloc riche seulement quand le contenu l'exige. Une consigne
// de forme, aucune interdiction ; la convention ```chart est lue par l'interface (graphique en barres ou en
// courbe), un bloc invalide y reste du code brut.
export const ANSWER_FORMAT_RULE =
  'Forme de la réponse finale (rendue en markdown par l’interface) : une phrase d’ouverture, puis des titres (###), des listes et des tableaux markdown ; une section « À vérifier » pour les points non confirmés. Pour une série chiffrée de 4 valeurs ou plus, émets un bloc ```chart contenant un JSON {"type":"bar" ou "line","title":"…","source":"…","x":[…],"y":[nombres],"highlight":[indices à mettre en avant]} ; pour une comparaison, un tableau markdown.';
