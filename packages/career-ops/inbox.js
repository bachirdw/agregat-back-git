// The Skill's inbox, data/pipeline.md (modes/pipeline.md « Format of pipeline.md »). A pending
// entry is « - [ ] url | company | title » (1 to 5 cells, then labelled segments), an unreachable
// one « - [!] url — note », a processed one « - [x] #NNN | url | … », « - [x] #-- | url | skipped (…) »,
// « - [x] [NNN](reports/…) | url | … » or « - [x] ~~url | company | title~~ — posting expired ».
// Headings and free text are the file's own (scan.mjs skeleton, sections in any language). An
// entry is only ever ticked, by the mode, scan.mjs or reconcile-pipeline.mjs: never removed.
// Read by career_write (form, no removal) and by the Bilan (counts before and after a turn).
const INBOX_ITEM = /^- \[([ x!])\] (.*)$/;
const INBOX_LIKE = /^\s*[-*]\s*\[.?\]/;
const INBOX_URL = /(?:https?:\/\/|local:)[^\s|]+/;
// Under-strip on purpose, as url-key.mjs: a trailing slash only, never a query parameter.
const inboxKey = (url) => url.replace(/[~/]+$/, '');
export function inboxEntries(text, strict = false) {
  const entries = [];
  const refuse = (index) => {
    if (strict)
      throw new Error(
        `data/pipeline.md : ligne ${index + 1} refusée ; une entrée est « - [ ] url | entreprise | poste », « - [x] #NNN | url | … » ou « - [!] url — note » (modes/pipeline.md)`,
      );
  };
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((line, index) => {
      const item = line.match(INBOX_ITEM);
      if (!item) {
        if (INBOX_LIKE.test(line)) refuse(index);
        return;
      }
      const body = item[2].replace(/^~~([\s\S]*?)~~/, '$1').trim();
      const url = body.match(INBOX_URL)?.[0];
      const leadsWithUrl = INBOX_URL.test(body.split(/[\s|]+/)[0] ?? '');
      if (!url || (item[1] !== 'x' && !leadsWithUrl)) return refuse(index);
      entries.push({ state: item[1], key: inboxKey(url) });
    });
  return entries;
}
// What a turn did to the entries that were pending when it started: ticked « [x] », marked
// « [!] », still « [ ] », or gone (career_write refuses that; another writer may not).
// `remaining` counts every « [ ] » after the turn, entries added meanwhile included.
export function inboxDelta(before, after) {
  const now = new Map(after.map((entry) => [entry.key, entry.state]));
  const pending = before.filter((entry) => entry.state === ' ');
  const count = (state) => pending.filter((entry) => now.get(entry.key) === state).length;
  return {
    pending: pending.length,
    processed: count('x'),
    unconfirmed: count('!'),
    remaining: after.filter((entry) => entry.state === ' ').length,
    missing: pending.filter((entry) => !now.has(entry.key)).length,
  };
}
