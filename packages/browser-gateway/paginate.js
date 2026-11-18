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
// its link, from rank `offset`. review2-captures-18-11 : as before the sprint, `text` is the texts
// of the first `limit` elements joined by a newline and cut at `maxChars` (each text counted once,
// a link never at its expense) and `count` their number ; `items` are the elements whose text
// starts in it, the last one cut if the cut falls in it (`textTruncated`, `textChars`). `total` is
// every element found ; a caller that read only the window in the page passes the total it counted
// (`read.total`). `nextOffset` is the first rank not read in full : the cut element is read again
// from its start, unless it was alone (its rest does not fit in maxChars).
export const LINK_MAX_CHARS = 8192;

// The address of a listed element, left out (its size said) above LINK_MAX_CHARS.
function linkOf(element) {
  const href = element?.href ? String(element.href) : null;
  if (element?.hrefChars) return { hrefChars: element.hrefChars };
  if (href && href.length > LINK_MAX_CHARS) return { hrefChars: href.length };
  return href ? { href } : {};
}

export function paginateItems(all, { offset = 0, limit = 1, maxChars = 20000 } = {}, read = {}) {
  const found = Array.isArray(all) ? all : [];
  const windowed = Number.isInteger(read.total);
  const total = windowed ? read.total : found.length;
  const start = Math.min(offset, total);
  const window = (windowed ? found : found.slice(start)).slice(0, limit);
  const texts = window.map((element) => String(element?.text ?? ''));
  const text = texts.join('\n').slice(0, maxChars);
  const items = [];
  let at = 0;
  for (let k = 0; k < window.length; k++) {
    const whole = texts[k];
    if (k > 0 && (at > text.length || (at === text.length && whole.length > 0))) break;
    const shown = text.slice(at, at + whole.length);
    at += whole.length + 1;
    items.push({
      text: shown,
      ...linkOf(window[k]),
      ...(shown.length < whole.length ? { textTruncated: true, textChars: whole.length } : {}),
    });
  }
  const endOffset = start + items.length;
  const cut = items.at(-1)?.textTruncated === true;
  const resume = cut && items.length > 1 ? endOffset - 1 : endOffset;
  const truncated = resume < total;
  const nextOffset = truncated ? resume : null;
  const remaining = truncated ? total - resume : 0;
  const paging =
    `${total} élément(s) trouvé(s) : rangs ${start} à ${endOffset} rendus` +
    (cut
      ? items.length > 1
        ? ' (texte du dernier élément rendu coupé à maxChars : voir textChars ; il est relu en entier à la suite)'
        : ' (texte de l’élément rendu coupé à maxChars : voir textChars)'
      : '') +
    (truncated
      ? ` ; suite : offset=${nextOffset}, ${remaining} élément(s) restant(s).`
      : ' ; fin de la liste.');
  return {
    items,
    text,
    count: window.length,
    total,
    offset,
    endOffset,
    truncated,
    nextOffset,
    remaining,
    paging,
    ...(truncated ? { truncation: `Suite disponible : rappeler avec offset=${nextOffset}.` } : {}),
  };
}
