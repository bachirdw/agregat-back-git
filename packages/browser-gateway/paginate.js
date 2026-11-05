// E27 : page text handed to an agent is bounded like career_read (E7): one page of `maxChars`
// characters from `offset`, with the continuation offset. The caller keeps the full text for
// its own needs (snapshot references), only the page leaves the gateway. The key is `truncation`:
// `notice` already carries the gateway's untrusted-content warning.
export const SNAPSHOT_DEFAULT_CHARS = 24000;
export const SNAPSHOT_MAX_CHARS = 48000;

export function paginateText(text, { offset = 0, maxChars = SNAPSHOT_DEFAULT_CHARS } = {}) {
  const whole = String(text ?? '');
  const page = whole.slice(offset, offset + maxChars);
  const truncated = offset + maxChars < whole.length;
  const nextOffset = truncated ? offset + page.length : null;
  return {
    page,
    offset,
    totalChars: whole.length,
    truncated,
    nextOffset,
    ...(truncated
      ? { truncation: `Suite disponible : recapturer avec offset=${nextOffset}.` }
      : {}),
  };
}
