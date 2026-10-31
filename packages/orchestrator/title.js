const IGNORED = new Set(
  `a à afin ai alors au aussi aux avec avoir c ca ça ce ces cette chez comme comment d dans de des dis
  donc donne donner du elle en es est et étant être fais faire il ils j je l la le les leur lui m ma
  me mes moi mon n ne nos notre nous on ou où par pas peux peut plaît plait pour pouvez pourrais puis
  qu quand que quel quelle quelles quels qui répond réponds s sa se ses si sil son sur t ta te tes
  toi ton trouve trouver tu un une va vais veux voudrais vous vos votre y
  a an and are can could find for from get give i in is it me my of on or please show tell the to
  what which with would you your cherche chercher ouvre ouvrir montre montrer aide aider merci bonjour
  uniquement seulement phrase`.split(/\s+/),
);

// Short name for the history, built from the prompt alone: no model call, no prompt copy.
export function missionTitle(prompt, { words = 3 } = {}) {
  const first = String(prompt ?? '')
    .trim()
    .split(/[.?!\n]\s|\n/)[0];
  const hosts = [...first.matchAll(/https?:\/\/(?:www\.)?([^\s/?#]+)/gi)].map((m) => m[1]);
  const text = first
    .replace(/https?:\/\/\S+/gi, ' ')
    // « À partir de mon CV, cherche… » : the opening clause names the source, not the topic.
    .replace(/^\s*(?:à|a) partir (?:du|de|d’|d')[^,]*,/i, ' ');
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter((token) => token.length > 1 && !IGNORED.has(token));
  const picked = [...hosts, ...tokens].slice(0, words);
  if (!picked.length) return 'Mission';
  const title = picked.join(' ').slice(0, 40).trim();
  return title[0].toUpperCase() + title.slice(1);
}
