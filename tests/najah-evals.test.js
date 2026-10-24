import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../packages/orchestrator/packs.js';
import {
  buildRegister,
  checkSponsors,
  normalizeArbeitnow,
  normalizeRemotive,
  rankLive,
} from '../domain-packs/najah/live.js';

const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const evals = JSON.parse(read('domain-packs/najah/evals/ranking.json'));
const offers = [
  ...normalizeArbeitnow(
    JSON.parse(read('tests/fixtures/najah-recorded/arbeitnow.json')),
    'enregistré',
  ),
  ...normalizeRemotive(
    JSON.parse(read('tests/fixtures/najah-recorded/remotive.json')),
    'enregistré',
  ),
];
const register = buildRegister(read('tests/fixtures/najah-recorded/uk-sponsors-sample.csv'));
const sponsors = checkSponsors(register, [...new Set(offers.map((o) => o.company))], {});

for (const c of evals.cases)
  test(`évaluation Najah : ${c.id}`, () => {
    const ranked = rankLive(c.query, offers, sponsors);
    const top = ranked[0];
    const e = c.expect;
    if (e.topTitleIncludes) assert.ok(top.title.includes(e.topTitleIncludes), top.title);
    if (e.topLocationIncludes)
      assert.ok(top.location.includes(e.topLocationIncludes), top.location);
    if (e.topReasonsInclude)
      assert.ok(
        top.reasons.some((r) => r.includes(e.topReasonsInclude)),
        top.reasons.join(';'),
      );
    if (e.noSponsorshipBeyond)
      assert.ok(ranked.every((o) => e.noSponsorshipBeyond.includes(o.sponsorship)));
    if (e.companyNotMatched)
      assert.ok(
        ranked
          .filter((o) => o.company === e.companyNotMatched)
          .every((o) => o.sponsorship === 'unknown'),
      );
    if (e.maxTopScore !== undefined) assert.ok(top.score <= e.maxTopScore, String(top.score));
  });
