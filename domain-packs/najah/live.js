import { isDeepStrictEqual } from 'node:util';

// Najah on REAL public sources. Every opportunity keeps its source, URL and fetch time; sponsorship
// is never inferred: it is "unknown" unless a primary source says otherwise, and a register name
// match is reported as such (same name ≠ proven same legal entity).
export const SOURCES = {
  arbeitnow: {
    url: 'https://www.arbeitnow.com/api/job-board-api?page=1',
    attribution: 'Arbeitnow (https://www.arbeitnow.com)',
  },
  remotive: {
    url: (q) => `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=50`,
    attribution: 'Remotive (https://remotive.com) — offre à consulter sur Remotive',
  },
};
export const UK_REGISTER = {
  page: 'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers',
  licence: 'Open Government Licence v3.0',
};

const STOP = new Set(
  'de des du la le les et en un une pour avec sans dans sur ou au aux à idéalement idealement ideally or offres offre emploi emplois jobs job poste postes rechercher chercher trouver puis classer les the and for with in of a an to remote télétravail teletravail distance visa visas sponsor sponsoring sponsorship travail profil très plus'.split(
    ' ',
  ),
);
// Skills dominate the score; role words come next; other words only lightly.
export const TECH = new Set(
  'python sql java javascript typescript react angular vue node node.js rails ruby go golang rust c++ c# .net php laravel django flask fastapi scala kotlin swift ios android aws gcp azure kubernetes docker terraform linux spark airflow dbt snowflake bigquery postgres postgresql mysql mongodb kafka pandas pytorch tensorflow ml ai llm etl bi tableau powerbi excel r data'.split(
    ' ',
  ),
);
export const ROLES = new Set(
  'engineer engineering developer développeur developpeur ingénieur ingenieur analyst analyste scientist manager architect architecte devops sre designer lead consultant administrator'.split(
    ' ',
  ),
);
const tokens = (text) =>
  new Set(
    String(text)
      .toLowerCase()
      .match(/[\p{L}\p{N}+#.]+/gu) ?? [],
  );
export function keywords(query) {
  return [
    ...new Set(
      (query.toLowerCase().match(/[\p{L}\p{N}+#.]+/gu) ?? []).map((w) => w.replace(/\.$/, '')),
    ),
  ]
    .filter((w) => w.length > 1 && !STOP.has(w))
    .slice(0, 12);
}
const stripHtml = (html = '') =>
  String(html)
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]*>/g, ' ')
    .replace(/<[^>]*$/, ' ') // tag cut by truncation
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function normalizeArbeitnow(body, fetchedAt) {
  return (body?.data ?? []).map((j) => ({
    id: 'arbeitnow:' + j.slug,
    source: 'arbeitnow',
    title: String(j.title ?? '').slice(0, 200),
    company: String(j.company_name ?? '')
      .trim()
      .slice(0, 200),
    location: String(j.location ?? '').slice(0, 200),
    remote: !!j.remote,
    tags: (j.tags ?? []).map(String).slice(0, 20),
    url: j.url,
    publishedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
    excerpt: stripHtml(j.description).slice(0, 600),
    sponsorship: 'unknown',
    fetchedAt,
    attribution: SOURCES.arbeitnow.attribution,
  }));
}
export function normalizeRemotive(body, fetchedAt) {
  return (body?.jobs ?? []).map((j) => ({
    id: 'remotive:' + j.id,
    source: 'remotive',
    title: String(j.title ?? '').slice(0, 200),
    company: String(j.company_name ?? '')
      .trim()
      .slice(0, 200),
    location: String(j.candidate_required_location ?? '').slice(0, 200),
    remote: true,
    tags: (j.tags ?? []).map(String).slice(0, 20),
    url: j.url,
    publishedAt: j.publication_date ? new Date(j.publication_date).toISOString() : null,
    excerpt: stripHtml(j.description).slice(0, 600),
    sponsorship: 'unknown',
    fetchedAt,
    attribution: SOURCES.remotive.attribution,
  }));
}

export async function searchJobs(data, { query, sources = ['arbeitnow', 'remotive'], limit = 40 }) {
  const words = keywords(query);
  const offers = [];
  const errors = [];
  for (const source of sources) {
    try {
      if (source === 'arbeitnow') {
        const r = await data.get(SOURCES.arbeitnow.url, { ttlMs: 3600_000, maxBytes: 8_000_000 });
        offers.push(...normalizeArbeitnow(r.body, r.fetchedAt));
      } else if (source === 'remotive') {
        const term =
          words.find((w) => TECH.has(w) && w !== 'data') ??
          words.find((w) => /^[a-z+#.]+$/.test(w)) ??
          'python';
        const r = await data.get(SOURCES.remotive.url(term), { ttlMs: 6 * 3600_000 });
        offers.push(...normalizeRemotive(r.body, r.fetchedAt));
      } else errors.push({ source, error: 'Source inconnue' });
    } catch (e) {
      errors.push({ source, error: String(e.message).slice(0, 200) });
    }
  }
  // Keep offers that mention at least one keyword as a whole word (title, tags, excerpt), newest first.
  const relevant = offers
    .filter((o) => {
      const hay = tokens(o.title + ' ' + o.tags.join(' ') + ' ' + o.excerpt);
      return !words.length || words.some((w) => hay.has(w));
    })
    .sort(
      (a, b) =>
        String(b.publishedAt).localeCompare(String(a.publishedAt)) || a.id.localeCompare(b.id),
    )
    .slice(0, limit);
  return {
    live: true,
    simulated: false,
    query,
    keywords: words,
    offers: relevant,
    companies: [...new Set(relevant.map((o) => o.company).filter(Boolean))].slice(0, 60),
    errors,
    evidence: relevant.map((o) => ({ source: o.attribution, url: o.url, fetchedAt: o.fetchedAt })),
  };
}

// ---------- UK register of licensed sponsors (primary source, gov.uk) ----------
export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
const SUFFIXES =
  /\b(ltd|limited|plc|llp|llc|inc|incorporated|gmbh|ag|sa|sas|bv|pty|co|company|group|holdings|uk|the)\b/g;
export function normalizeCompany(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/t\/a.*$/, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function buildRegister(csvText) {
  const rows = parseCsv(csvText);
  const header = rows.shift()?.map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const [iName, iTown, iRating, iRoute] = [
    'Organisation Name',
    'Town/City',
    'Type & Rating',
    'Route',
  ].map(idx);
  if (iName < 0 || iRoute < 0) throw new Error('Format du registre inattendu');
  const map = new Map();
  for (const r of rows) {
    if (!r[iName]?.trim()) continue;
    const key = normalizeCompany(r[iName]);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push({
      name: r[iName].trim(),
      town: (r[iTown] ?? '').trim(),
      rating: (r[iRating] ?? '').trim(),
      route: (r[iRoute] ?? '').trim(),
    });
    map.set(key, list);
  }
  return map;
}
export function checkSponsors(register, companies, meta) {
  return companies.map((company) => {
    const key = normalizeCompany(company);
    const matches = key ? (register.get(key) ?? []) : [];
    return {
      company,
      jurisdiction: 'UK',
      status: matches.length ? 'name_listed' : 'not_listed',
      // A name match is NOT proof that the hiring entity is the licensed sponsor.
      caveat: matches.length
        ? 'Nom présent au registre britannique ; identité juridique de l’employeur non confirmée.'
        : 'Absent du registre britannique sous ce nom ; ne dit rien des autres pays.',
      routes: [...new Set(matches.map((m) => m.route))].slice(0, 6),
      matches: matches.slice(0, 5),
      register: meta,
    };
  });
}
export async function loadUkRegister(data) {
  const page = await data.get(UK_REGISTER.page, { ttlMs: 24 * 3600_000 });
  const csv = page.body?.details?.attachments?.find((a) => a.content_type === 'text/csv');
  if (!csv?.url) throw new Error('Pièce jointe CSV du registre introuvable');
  const file = await data.get(csv.url, {
    as: 'text',
    maxBytes: 30_000_000,
    timeoutMs: 120000,
    ttlMs: 24 * 3600_000,
  });
  return {
    register: buildRegister(file.body),
    meta: {
      url: csv.url,
      page: 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers',
      publishedAt: page.body.public_updated_at ?? null,
      fetchedAt: file.fetchedAt,
      licence: UK_REGISTER.licence,
    },
  };
}

// French ↔ English place names, so « Australie » matches « Australia ».
export const PLACE_ALIASES = {
  australie: ['australia'],
  allemagne: ['germany', 'deutschland'],
  'royaume-uni': ['united kingdom', 'uk', 'england', 'london'],
  angleterre: ['england', 'united kingdom', 'uk'],
  londres: ['london'],
  berlin: ['berlin'],
  canada: ['canada'],
  irlande: ['ireland'],
  'pays-bas': ['netherlands'],
  espagne: ['spain'],
  europe: ['europe', 'emea'],
  monde: ['worldwide', 'anywhere'],
};
// ---------- deterministic, explainable ranking ----------
export function rankLive(query, offers = [], sponsors = []) {
  const words = keywords(query);
  const q = query.toLowerCase();
  const wantsVisa = /visa|sponsor/.test(q);
  const wantsRemote = /remote|télétravail|teletravail|à distance/.test(q);
  const bySponsor = new Map(sponsors.map((s) => [s.company, s]));
  return offers
    .map((o) => {
      const reasons = [];
      let score = 0;
      const title = tokens(o.title);
      const tags = tokens(o.tags.join(' '));
      const body = tokens(o.excerpt);
      for (const w of words) {
        if (TECH.has(w)) {
          const pts = title.has(w) ? 30 : tags.has(w) ? 20 : body.has(w) ? 10 : 0;
          if (pts) {
            score += pts;
            reasons.push(
              `Compétence ${w} (${pts === 30 ? 'titre' : pts === 20 ? 'tags' : 'description'})`,
            );
          }
        } else if (ROLES.has(w)) {
          if (title.has(w)) {
            score += 15;
            reasons.push(`Métier dans le titre : ${w}`);
          }
        } else if (!PLACE_ALIASES[w] && (title.has(w) || body.has(w))) {
          score += 5;
          reasons.push(`Mot-clé présent : ${w}`);
        }
      }
      const loc = o.location.toLowerCase();
      const place = words.find(
        (w) => w.length > 3 && [w, ...(PLACE_ALIASES[w] ?? [])].some((p) => loc.includes(p)),
      );
      if (place) {
        score += 15;
        reasons.push(`Lieu correspondant : ${o.location}`);
      }
      if (wantsRemote && o.remote) {
        score += 10;
        reasons.push('Télétravail indiqué par la source');
      }
      const s = bySponsor.get(o.company);
      let sponsorship = o.sponsorship;
      if (s?.status === 'name_listed') {
        sponsorship = 'uk_register_name_match';
        if (wantsVisa) {
          score += 10;
          reasons.push('Nom présent au registre UK des sponsors (entité à confirmer)');
        }
      }
      if (!reasons.length) reasons.push('Aucun critère correspondant ; score nul');
      return { ...o, sponsorship, score, reasons };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(b.publishedAt).localeCompare(String(a.publishedAt)) ||
        a.id.localeCompare(b.id),
    );
}

// Independent verification: recompute the ranking from the fetched evidence and check provenance.
export function verifyLive(result, objective, inputs) {
  const search = inputs?.search;
  if (!search?.live) throw new Error('Vérification live : résultat de recherche absent');
  const expected = rankLive(objective, search.offers, inputs?.sponsors?.results ?? []);
  if (!isDeepStrictEqual(result.opportunities, expected))
    throw new Error('Résultat Najah invalide : classement différent du recalcul indépendant');
  for (const o of result.opportunities) {
    if (!/^https:\/\//.test(o.url ?? '') || !o.fetchedAt || !o.attribution)
      throw new Error(`Provenance incomplète : ${o.id}`);
    if (!['unknown', 'uk_register_name_match'].includes(o.sponsorship))
      throw new Error(`Statut de sponsoring non justifié : ${o.id}`);
  }
  return result;
}
