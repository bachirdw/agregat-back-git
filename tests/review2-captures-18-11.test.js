// review2-captures-18-11 : correction des constats confirmés sur browser_extract en liste, sans
// navigateur. C1 : un appel d'hier (limit de 2 à 20, sans offset) rend au moins les éléments et le
// texte d'avant le sprint, le texte compté une seule fois et le lien jamais à ses dépens. C2 : la page
// ne lit que la fenêtre demandée (offset à offset+limit), le total est compté à part, avec une borne
// de temps. Exemples FICTIFS seulement (domaine example.test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LINK_MAX_CHARS, paginateItems } from '../packages/browser-gateway/paginate.js';
import { listedElements } from '../packages/browser-gateway/cdp.js';

// The list path of browser.extract before the sprint (4b7b3b6, cdp.js) : the first min(found, limit)
// texts joined by a newline, cut at maxChars, and their number.
function before(list, { limit, maxChars }) {
  const count = Math.min(list.length, limit);
  return {
    text: list
      .slice(0, count)
      .map((element) => element.text)
      .join('\n')
      .slice(0, maxChars),
    count,
  };
}
const traceable = (length, seed = 0) =>
  Array.from({ length }, (_, i) => String.fromCharCode(97 + ((i + seed) % 26))).join('');
const card = (i, length, hrefLength = 0) => ({
  text: traceable(length, i),
  href: hrefLength
    ? `https://jobs.example.test/offre/${i}?` + 'q'.repeat(Math.max(0, hrefLength - 40))
    : null,
});

test('C1 : 20 cartes de 600 à 700 caractères, maxChars 20 000 : les 20 rendues, comme avant', () => {
  for (const hrefLength of [0, 215]) {
    const cards = Array.from({ length: 20 }, (_, i) => card(i, 600 + i * 5, hrefLength));
    const out = paginateItems(cards, { limit: 20, maxChars: 20000 });
    const old = before(cards, { limit: 20, maxChars: 20000 });
    assert.equal(out.count, 20);
    assert.equal(out.items.length, 20);
    assert.equal(out.text, old.text);
    assert.ok(out.items.every((item, i) => item.text === cards[i].text && !item.textTruncated));
    assert.equal(out.truncated, false);
    assert.equal(out.nextOffset, null);
  }
});

test('C1 : un élément de 15 000 caractères est rendu entier, comme avant', () => {
  const out = paginateItems([card(0, 15000), card(1, 10)], { limit: 2, maxChars: 20000 });
  assert.equal(out.items[0].text.length, 15000);
  assert.equal(out.items[0].textTruncated, undefined);
  assert.equal(out.text, before([card(0, 15000), card(1, 10)], { limit: 2, maxChars: 20000 }).text);
});

test('C1 : trois éléments de 8 000 caractères, maxChars 20 000 : 20 000 caractères et count 3', () => {
  const list = [0, 1, 2].map((i) => card(i, 8000, 90));
  const out = paginateItems(list, { limit: 3, maxChars: 20000 });
  assert.equal(out.text.length, 20000);
  assert.equal(out.text, before(list, { limit: 3, maxChars: 20000 }).text);
  assert.equal(out.count, 3);
  assert.equal(out.items.length, 3);
  assert.equal(out.items[2].textTruncated, true);
  assert.equal(out.items[2].textChars, 8000);
  // The cut element is the first one read again, in full, by the next call.
  assert.equal(out.nextOffset, 2);
  const next = paginateItems(list, { offset: out.nextOffset, limit: 3, maxChars: 20000 });
  assert.equal(next.items[0].text, list[2].text);
});

test('C1 : un lien plus long que maxChars ne vide jamais le texte du premier élément', () => {
  const list = [card(0, 400, 250), card(1, 400, 250)];
  const out = paginateItems(list, { limit: 5, maxChars: 200 });
  assert.equal(out.text, list[0].text.slice(0, 200));
  assert.equal(out.items[0].text, list[0].text.slice(0, 200));
  assert.equal(out.items[0].href, list[0].href);
  // Alone and cut, the element is not read again : the next call starts after it.
  assert.equal(out.nextOffset, 1);
  const li = ['FICTIF premier', 'FICTIF deuxième', 'FICTIF troisième'].map((text) => ({
    text,
    href: null,
  }));
  assert.equal(paginateItems(li, { limit: 20, maxChars: 6 }).text, 'FICTIF');
});

test('C1 : appels d’hier tirés au hasard, jamais moins d’éléments ni moins de texte qu’avant', () => {
  let seed = 11;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  for (let round = 0; round < 300; round++) {
    const list = Array.from({ length: next() % 30 }, (_, i) =>
      card(i, next() % 3000, next() % 2 ? 30 + (next() % 400) : 0),
    );
    const limit = 2 + (next() % 19);
    const maxChars = 1 + (next() % 50000);
    const out = paginateItems(list, { limit, maxChars });
    const old = before(list, { limit, maxChars });
    assert.equal(out.text, old.text, `tour ${round}`);
    assert.equal(out.count, old.count, `tour ${round}`);
    assert.equal(out.total, list.length);
  }
});

test('C1 : en suivant nextOffset, chaque élément est lu en entier (ou jusqu’à maxChars s’il est seul plus long), et la suite finit', () => {
  let seed = 5;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  for (let round = 0; round < 60; round++) {
    const list = Array.from({ length: next() % 50 }, (_, i) =>
      card(i, next() % 600, next() % 2 ? 60 : 0),
    );
    const limit = 2 + (next() % 40);
    const maxChars = 1 + (next() % 1500);
    const best = new Map();
    let offset = 0;
    let calls = 0;
    for (;;) {
      const out = paginateItems(list, { offset, limit, maxChars });
      calls++;
      assert.ok(calls <= list.length + 1, `tour ${round} : la suite doit finir`);
      out.items.forEach((item, k) => {
        assert.ok(list[offset + k].text.startsWith(item.text));
        assert.equal(item.href, list[offset + k].href ?? undefined);
        if (!best.has(offset + k) || best.get(offset + k).length < item.text.length)
          best.set(offset + k, item.text);
      });
      if (!out.truncated) break;
      assert.ok(out.nextOffset > offset, 'la suite avance toujours');
      offset = out.nextOffset;
    }
    list.forEach((element, i) =>
      assert.equal(best.get(i), element.text.slice(0, maxChars), `tour ${round}, rang ${i}`),
    );
  }
});

test('C2 : la fonction de page ne lit que la fenêtre demandée', () => {
  const reads = [];
  const element = (i) => ({
    get innerText() {
      reads.push(i);
      return `Carte FICTIVE ${i}`;
    },
    closest: () => null,
    querySelector: (selector) =>
      selector === 'a[href]' ? { href: `https://jobs.example.test/offre/${i}` } : null,
  });
  const elements = Array.from({ length: 500 }, (_, i) => element(i));
  const out = listedElements(elements, { offset: 40, limit: 2 });
  assert.deepEqual(reads, [40, 41]);
  assert.deepEqual(out, [
    { text: 'Carte FICTIVE 40', href: 'https://jobs.example.test/offre/40' },
    { text: 'Carte FICTIVE 41', href: 'https://jobs.example.test/offre/41' },
  ]);
  // Without a window (the sprint's call), every element is still read : unchanged for its tests.
  reads.length = 0;
  assert.equal(listedElements(elements.slice(0, 3)).length, 3);
  assert.deepEqual(reads, [0, 1, 2]);
});

test('C2 : une fenêtre lue dans la page et le total compté à part donnent les mêmes rangs', () => {
  const list = Array.from({ length: 300 }, (_, i) => card(i, 30, 60));
  for (const [offset, limit] of [
    [0, 2],
    [40, 20],
    [290, 1000],
    [300, 5],
    [400, 5],
  ]) {
    const whole = paginateItems(list, { offset, limit, maxChars: 20000 });
    const windowed = paginateItems(
      list.slice(offset, offset + limit),
      { offset, limit, maxChars: 20000 },
      { total: list.length },
    );
    assert.deepEqual(windowed, whole, `offset ${offset}, limit ${limit}`);
  }
});

test('C2 : un lien démesuré n’est pas rendu, sa taille est dite', () => {
  const huge = `https://jobs.example.test/offre?d=${'x'.repeat(LINK_MAX_CHARS)}`;
  const out = paginateItems([{ text: 'Carte FICTIVE', href: huge }], { limit: 2, maxChars: 100 });
  assert.equal(out.items[0].href, undefined);
  assert.equal(out.items[0].hrefChars, huge.length);
  const element = {
    innerText: 'Carte FICTIVE',
    closest: () => ({ href: huge }),
    querySelector: () => null,
  };
  assert.deepEqual(listedElements([element], { offset: 0, limit: 1, linkMax: LINK_MAX_CHARS }), [
    { text: 'Carte FICTIVE', href: null, hrefChars: huge.length },
  ]);
});

test('C2 (lecture du code) : le chemin liste de cdp.js lit la fenêtre, compte à part, sous une borne de temps', () => {
  const source = readFileSync(
    new URL('../packages/browser-gateway/cdp.js', import.meta.url),
    'utf8',
  );
  const start = source.indexOf("case 'browser.extract'");
  const list = source.slice(start, source.indexOf("case 'browser.click'", start));
  assert.match(list, /matches\.count\(\)/);
  assert.match(list, /evaluateAll\(listedElements, \{/);
  assert.match(list, /readTimeout\(\)/);
  assert.match(list, /\{ total \}/);
  assert.doesNotMatch(list, /evaluateAll\(listedElements\)/);
});
