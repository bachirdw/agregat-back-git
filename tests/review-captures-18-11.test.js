// review-captures-18-11 : relecture du sprint captures-18-11 (E131, E132), sans navigateur. Tailles
// autour des bornes, suite exacte des listes, cas d'un test Chrome existant rejoué sur la fonction pure,
// lien d'un élément SVG, et aucun chemin de coupe silencieuse restant dans la passerelle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, FixturePageProvider } from '../packages/browser-gateway/index.js';
import { paginateItems, paginateText } from '../packages/browser-gateway/paginate.js';
import { listedElements } from '../packages/browser-gateway/cdp.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import {
  PAGE_TEXT_DEFAULT_CHARS,
  PAGE_TEXT_MAX_CHARS,
  capabilityIds,
} from '../packages/capability-registry/index.js';

const PAGE = 'https://jobs.example.com/resultats';
// Every character traceable : position i holds a letter that depends on i.
const traceable = (length) =>
  Array.from({ length }, (_, i) => String.fromCharCode(97 + (i % 26))).join('');

function gateway(pages) {
  return new BrowserGateway({
    provider: new FixturePageProvider(pages),
    policy: new RunPolicy({
      ownerMode: true,
      allowedDomains: ['example.com'],
      capabilities: capabilityIds,
      workspace: mkdtempSync(join(tmpdir(), 'relay-review-captures-')),
      resolveHost: async () => ['93.184.216.34'],
    }),
    approve: async () => false,
    meter: () => {},
  });
}

// Reads a whole text through paginateText, checking every page on the way.
function readAll(text, maxChars) {
  let offset = 0;
  let read = '';
  let calls = 0;
  let first = null;
  for (;;) {
    const out = paginateText(text, { offset, maxChars });
    first ??= out;
    calls++;
    assert.equal(out.page.length, Math.min(maxChars, text.length - offset));
    assert.equal(out.endOffset, offset + out.page.length);
    assert.equal(out.totalChars, text.length);
    assert.equal(out.pagesLeft, Math.ceil((text.length - out.endOffset) / maxChars));
    read += out.page;
    if (!out.truncated) {
      assert.equal(out.nextOffset, null);
      assert.equal(out.pagesLeft, 0);
      break;
    }
    assert.equal(out.nextOffset, out.endOffset, 'la suite désigne le premier caractère non rendu');
    offset = out.nextOffset;
  }
  return { read, calls, first };
}

test('E131 : texte plus court, égal, plus long que la tranche : rendu sans trou ni doublon', () => {
  for (const maxChars of [1, 7, 1000, PAGE_TEXT_DEFAULT_CHARS]) {
    for (const length of [
      0,
      1,
      maxChars - 1,
      maxChars,
      maxChars + 1,
      2 * maxChars,
      2 * maxChars + 1,
    ]) {
      const text = traceable(length);
      const { read, calls, first } = readAll(text, maxChars);
      assert.equal(read, text, `taille ${length}, tranche ${maxChars}`);
      assert.equal(calls, 1 + first.pagesLeft, `taille ${length}, tranche ${maxChars}`);
      assert.equal(first.truncated, length > maxChars);
    }
  }
});

test('E131 FICTIF : capture égale à la borne, puis un caractère de plus, par la passerelle', async () => {
  const exact = traceable(PAGE_TEXT_MAX_CHARS);
  const over = traceable(PAGE_TEXT_MAX_CHARS + 1);
  const gw = gateway({
    [PAGE]: { title: 'Résultats', text: exact },
    [PAGE + '/plus']: { title: 'Résultats', text: over },
  });
  const whole = await gw.call('browser.snapshot', { url: PAGE, maxChars: PAGE_TEXT_MAX_CHARS });
  assert.equal(whole.snapshot, exact);
  assert.equal(whole.truncated, false);
  assert.equal(whole.nextOffset, null);
  assert.match(whole.paging, /fin de la capture\.$/);
  const first = await gw.call('browser.snapshot', {
    url: PAGE + '/plus',
    maxChars: PAGE_TEXT_MAX_CHARS,
  });
  assert.equal(first.snapshot, over.slice(0, PAGE_TEXT_MAX_CHARS));
  assert.equal(first.nextOffset, PAGE_TEXT_MAX_CHARS);
  assert.equal(first.pagesLeft, 1);
  const last = await gw.call('browser.snapshot', {
    offset: first.nextOffset,
    maxChars: PAGE_TEXT_MAX_CHARS,
  });
  assert.equal(first.snapshot + last.snapshot, over);
  assert.equal(last.truncated, false);
});

test('E132 : quelles que soient les tailles, chaque rang est rendu une fois, total et reste exacts', () => {
  // Deterministic pseudo-random lists (no Math.random) : texts of 0 to 300 characters, half with links.
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  for (let round = 0; round < 40; round++) {
    const size = next() % 60;
    const all = Array.from({ length: size }, (_, i) => ({
      text: traceable(next() % 300),
      href: next() % 2 ? `https://jobs.example.com/offre/${i}` : null,
    }));
    const limit = 2 + (next() % 30);
    const maxChars = 1 + (next() % 2000);
    let offset = 0;
    const ranks = [];
    for (let calls = 0; calls <= size + 1; calls++) {
      const out = paginateItems(all, { offset, limit, maxChars });
      const window = all.slice(offset, offset + limit);
      assert.equal(out.total, size);
      // review2-captures-18-11 : count, text comme avant le sprint (fenêtre lue, textes joints coupés
      // à maxChars, chacun compté une fois) ; items, ceux dont le texte commence dans text.
      assert.equal(out.count, window.length);
      assert.ok(out.items.length <= out.count);
      assert.equal(
        out.text,
        window
          .map((element) => element.text)
          .join('\n')
          .slice(0, maxChars),
      );
      assert.equal(out.endOffset, Math.min(offset, size) + out.items.length);
      assert.equal(out.remaining, out.truncated ? size - out.nextOffset : 0);
      out.items.forEach((item, k) => {
        const source = all[offset + k];
        if (item.textTruncated) {
          // Only the last element rendered is cut, and it says its whole size.
          assert.equal(k, out.items.length - 1);
          assert.equal(item.textChars, source.text.length);
          assert.ok(source.text.startsWith(item.text));
          // Cut alone, it is not read again ; cut after others, it is read again from its start.
          if (out.items.length === 1) ranks.push(offset + k);
        } else {
          assert.equal(item.text, source.text);
          ranks.push(offset + k);
        }
        assert.equal(item.href, source.href ?? undefined);
      });
      if (!out.truncated) {
        assert.equal(out.nextOffset, null);
        break;
      }
      assert.ok(out.nextOffset > offset, 'la suite avance toujours');
      offset = out.nextOffset;
    }
    assert.deepEqual(
      ranks,
      all.map((_, i) => i),
      `tour ${round}`,
    );
  }
});

test('E132 : le cas Chrome « li, limit 20, maxChars 6 » rejoué sans navigateur', () => {
  // Same elements as the Chrome fixture page of owner-browser.test.js : its expectation follows this.
  const li = ['FICTIF premier', 'FICTIF deuxième', 'FICTIF troisième'].map((text) => ({
    text,
    href: null,
  }));
  const out = paginateItems(li, { limit: 20, maxChars: 6 });
  // review2-captures-18-11 : retour à l'attendu d'avant le sprint (le texte compte une fois).
  assert.equal(out.text, 'FICTIF');
  assert.equal(out.count, 3);
  assert.equal(out.items[0].textTruncated, true);
  assert.equal(out.items[0].textChars, 14);
  assert.equal(out.total, 3);
  assert.equal(out.nextOffset, 1);
  const whole = paginateItems(li, { limit: 3, maxChars: 100 });
  assert.equal(whole.text, 'FICTIF premier\nFICTIF deuxième\nFICTIF troisième');
  assert.equal(whole.count, 3);
});

test('E132 : le lien d’un élément SVG est rendu en adresse absolue, jamais en objet', () => {
  const svgLink = {
    href: { baseVal: '/offre/9', animVal: '/offre/9' },
    baseURI: 'https://jobs.example.com/resultats',
    getAttribute: (name) => (name === 'href' ? '/offre/9' : null),
  };
  const element = (closest) => ({
    innerText: 'Carte FICTIVE',
    closest: (selector) => (selector === 'a[href]' ? closest : null),
    querySelector: () => null,
  });
  assert.deepEqual(listedElements([element(svgLink)]), [
    { text: 'Carte FICTIVE', href: 'https://jobs.example.com/offre/9' },
  ]);
  assert.deepEqual(listedElements([element({ href: 'https://jobs.example.com/offre/1' })]), [
    { text: 'Carte FICTIVE', href: 'https://jobs.example.com/offre/1' },
  ]);
});

test('E131 : plus aucune coupe de texte de page à maxChars ni à une borne fixe dans la passerelle', () => {
  for (const file of ['cdp.js', 'index.js', 'paginate.js']) {
    const source = readFileSync(
      new URL(`../packages/browser-gateway/${file}`, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(source, /\.slice\(0, args\.maxChars\)/, file);
    assert.doesNotMatch(source, /MAX_TEXT|SNAPSHOT_MAX_CHARS/, file);
    // cdp.js keeps « [tronqué] » for the preview of a request body (previewBody), not page text.
    if (file !== 'cdp.js') assert.doesNotMatch(source, /\[tronqué\]/, file);
  }
});
