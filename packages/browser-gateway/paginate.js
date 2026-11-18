// E27 : page text handed to an agent is bounded like career_read (E7): one page of `maxChars`
// characters from `offset`, with the continuation offset. The caller keeps the full text for
// its own needs (snapshot references), only the page leaves the gateway. The key is `truncation`:
// `notice` already carries the gateway's untrusted-content warning.
// captures-18-11 (E131) : the bound lives in the capability registry only ; a page the schema
// accepts is rendered in full, and `nextOffset` is always the first character not rendered.
import { PAGE_TEXT_DEFAULT_CHARS } from '../capability-registry/index.js';

// One page of `text`, and in plain words : the whole size, the range rendered, where to resume and
// how many pages of this size are left.
export function paginateText(text, { offset = 0, maxChars = PAGE_TEXT_DEFAULT_CHARS } = {}) {
  const whole = String(text ?? '');
  const page = whole.slice(offset, offset + maxChars);
  const start = Math.min(offset, whole.length);
  const endOffset = start + page.length;
  const truncated = endOffset < whole.length;
  const nextOffset = truncated ? endOffset : null;
  const remainingChars = whole.length - endOffset;
  const pagesLeft = Math.ceil(remainingChars / maxChars);
  const paging =
    offset > whole.length
      ? `Capture de ${whole.length} caractères : offset=${offset} est au-delà de la fin, rien à rendre ; la capture se lit à partir d’offset=0.`
      : `Capture de ${whole.length} caractères : caractères ${start} à ${endOffset} rendus en entier` +
        (truncated
          ? ` ; suite : offset=${nextOffset}, ${remainingChars} caractères restants, soit ${pagesLeft} tranche(s) de ${maxChars}.`
          : ' ; fin de la capture.');
  return {
    page,
    offset,
    endOffset,
    totalChars: whole.length,
    truncated,
    nextOffset,
    pagesLeft,
    paging,
    ...(truncated
      ? { truncation: `Suite disponible : recapturer avec offset=${nextOffset}.` }
      : {}),
  };
}

// captures-18-11 (E132) : the elements a selector matched, each with its text and the address of
// its link, from rank `offset` : at most `limit` elements and `maxChars` characters (an element's
// text counts twice, once in `items` and once in the joined `text`, plus its address). `total` is
// every element found. An element alone above the budget is rendered with its text cut, and says
// so (`textTruncated`, `textChars`). `nextOffset` is the rank of the first element not rendered.
export function paginateItems(all, { offset = 0, limit = 1, maxChars = 20000 } = {}) {
  const found = Array.isArray(all) ? all : [];
  const items = [];
  let used = 0;
  for (let rank = offset; rank < found.length && items.length < limit; rank++) {
    const text = String(found[rank]?.text ?? '');
    const href = found[rank]?.href ? String(found[rank].href) : null;
    const cost = 2 * text.length + (href?.length ?? 0);
    if (used + cost > maxChars) {
      if (items.length > 0) break;
      const room = Math.max(0, Math.floor((maxChars - (href?.length ?? 0)) / 2));
      items.push({
        text: text.slice(0, room),
        ...(href ? { href } : {}),
        textTruncated: true,
        textChars: text.length,
      });
      break;
    }
    items.push({ text, ...(href ? { href } : {}) });
    used += cost;
  }
  const start = Math.min(offset, found.length);
  const endOffset = start + items.length;
  const truncated = endOffset < found.length;
  const nextOffset = truncated ? endOffset : null;
  const remaining = found.length - endOffset;
  const cut = items.some((item) => item.textTruncated);
  const paging =
    `${found.length} élément(s) trouvé(s) : rangs ${start} à ${endOffset} rendus` +
    (cut ? ' (texte de l’élément rendu coupé à maxChars : voir textChars)' : '') +
    (truncated
      ? ` ; suite : offset=${nextOffset}, ${remaining} élément(s) restant(s).`
      : ' ; fin de la liste.');
  return {
    items,
    text: items.map((item) => item.text).join('\n'),
    count: items.length,
    total: found.length,
    offset,
    endOffset,
    truncated,
    nextOffset,
    remaining,
    paging,
    ...(truncated ? { truncation: `Suite disponible : rappeler avec offset=${nextOffset}.` } : {}),
  };
}
