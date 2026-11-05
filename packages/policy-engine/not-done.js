// E66 : an error raised before the action ran — an approval not obtained, a page changed while
// the owner decided, a refused charge, a send already reserved — nothing was clicked, sent or
// uploaded. The gateway reports such a call `actionDone: false`, so the Bilan says « rien n'a été
// envoyé » rather than « issue incertaine ». A structured mark on the error (troisième relecture
// de nuit), never a reading of its message.
export function notDone(message, options) {
  return Object.assign(new Error(message, options), { actionDone: false });
}
