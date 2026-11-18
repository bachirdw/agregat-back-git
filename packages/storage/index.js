import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { meters } from '../billing/index.js';
export const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
export class Store extends EventEmitter {
  constructor(file) {
    super();
    this.setMaxListeners(100);
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), type TEXT NOT NULL, data TEXT NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS skills(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), dimension TEXT NOT NULL, units REAL, platform_cents INTEGER NOT NULL, external_cents INTEGER, at TEXT NOT NULL);
    `);
    // Append-only ledger, chained by SHA-256 so any edit or deletion is detectable (migration-safe).
    const cols = this.db
      .prepare('PRAGMA table_info(ledger)')
      .all()
      .map((c) => c.name);
    if (!cols.includes('prev_hash')) this.db.exec('ALTER TABLE ledger ADD COLUMN prev_hash TEXT');
    if (!cols.includes('hash')) this.db.exec('ALTER TABLE ledger ADD COLUMN hash TEXT');
    if (!cols.includes('hash_version'))
      this.db.exec('ALTER TABLE ledger ADD COLUMN hash_version INTEGER NOT NULL DEFAULT 1');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS ledger_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)',
    );
    // Per-run lookups (mission start, budget sum) without scanning the whole ledger (constat 7).
    this.db.exec('CREATE INDEX IF NOT EXISTS ledger_run ON ledger(run_id, id)');
    this.db
      .prepare('INSERT OR IGNORE INTO ledger_meta VALUES (?,?)')
      .run('anchor', JSON.stringify(this.ledgerHead()));
    this.limits = { monthlyCapCents: null };
    // Full chain check once at startup (cost linear, paid once); each charge then only checks the tail.
    // Relecture du 10/11 (constat 7) : the chain is verified in full at startup, then incrementally
    // (rows added since the last verified one), in full again at the first charge of each mission
    // and every `ledgerFullEvery` charges ; a run's budget is checked on its own rows, re-hashed.
    this.ledgerFullEvery =
      Number(process.env.AGENT_PLATFORM_LEDGER_FULL_EVERY) > 0
        ? Number(process.env.AGENT_PLATFORM_LEDGER_FULL_EVERY)
        : 500;
    // Per run: the sum and last row id last proven by verifyRunLedger() or written here. A sum or
    // last id that no longer matches the table re-verifies the run's rows before its budget is used.
    this.runSums = new Map();
    this.chargesSinceFullCheck = 0;
    this.ledgerBroken = null;
    this.verifiedTip = null;
    this.startupLedger = this.verifyLedger();
    for (const { data } of this.db.prepare('SELECT data FROM runs').all()) {
      let run;
      try {
        run = JSON.parse(data);
      } catch {
        continue; // one unreadable row must not prevent the platform from starting
      }
      if (!terminal.has(run.state))
        this.update(run.id, {
          state: 'interrupted',
          error: 'Serveur arrêté pendant l’exécution ; relancer explicitement.',
          // E75 : an open question had set `resumable: false` ; « relancer explicitement » holds only
          // if the run can be resumed, which its agent session decides (as when a question closes).
          resumable: !!run.sessionId,
          // The agent's turn is gone with the process: the open question is closed, but stays quoted.
          ...(run.pendingQuestion
            ? {
                pendingQuestion: null,
                result: {
                  simulated: !!run.result?.simulated,
                  summary: `Question restée sans réponse au redémarrage : ${run.pendingQuestion.message ?? ''}`,
                  evidence: [],
                },
              }
            : {}),
        });
    }
  }
  create(run) {
    this.db.prepare('INSERT INTO runs VALUES (?,?)').run(run.id, JSON.stringify(run));
    this.event(run.id, 'state', { state: run.state });
    return run;
  }
  get(id) {
    const row = this.db.prepare('SELECT data FROM runs WHERE id=?').get(id);
    return row ? JSON.parse(row.data) : null;
  }
  list() {
    return this.db
      .prepare('SELECT data FROM runs ORDER BY rowid DESC LIMIT 200')
      .all()
      .map((r) => JSON.parse(r.data));
  }
  // chef-01 : the sub-missions a mission launched (field `famille.mere`), in launch order. No
  // table of its own : `list()` stops at the 200 latest missions, this reads them all.
  children(id) {
    return this.db
      .prepare("SELECT data FROM runs WHERE json_extract(data, '$.famille.mere')=? ORDER BY rowid")
      .all(id)
      .map((r) => JSON.parse(r.data));
  }
  update(id, patch) {
    const run = this.get(id);
    if (!run) throw new Error('Run introuvable');
    Object.assign(run, patch);
    this.db.prepare('UPDATE runs SET data=? WHERE id=?').run(JSON.stringify(run), id);
    if (patch.state) this.event(id, 'state', { state: patch.state });
    return run;
  }
  event(id, type, data, { privatePreview = false, storedToolTitle = null } = {}) {
    const at = new Date().toISOString();
    const encoded = JSON.stringify(
      privatePreview
        ? { ...data, tool: { title: 'Envoi : aperçu privé disponible pendant la demande' } }
        : storedToolTitle
          ? { ...data, tool: { title: storedToolTitle } }
          : data,
    );
    if (Buffer.byteLength(encoded) > 262144) throw new Error('Événement trop volumineux');
    const row = this.db
      .prepare('INSERT INTO events(run_id,type,data,at) VALUES (?,?,?,?)')
      .run(id, type, encoded, at);
    const event = { seq: Number(row.lastInsertRowid), runId: id, type, data, at };
    try {
      this.emit(id, event);
    } catch {
      // A failing listener (e.g. an SSE socket destroyed meanwhile) must not fail the mission.
    }
    return event;
  }
  events(id, after = 0) {
    return this.db
      .prepare(
        'SELECT seq,run_id AS runId,type,data,at FROM events WHERE run_id=? AND seq>? ORDER BY seq',
      )
      .all(id, after)
      .map((r) => ({ ...r, data: JSON.parse(r.data) }));
  }
  skill(id) {
    const row = this.db.prepare('SELECT data FROM skills WHERE id=?').get(id);
    return row ? JSON.parse(row.data) : null;
  }
  skills() {
    return this.db
      .prepare('SELECT id, data FROM skills ORDER BY id')
      .all()
      .map((r) => ({ id: r.id, data: JSON.parse(r.data) }));
  }
  setSkill(id, value) {
    this.db
      .prepare('INSERT INTO skills VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .run(id, JSON.stringify(value));
  }
  static entryHash(prev, e) {
    const fields = [
      prev ?? '',
      e.run_id,
      e.dimension,
      e.units ?? '',
      e.platform_cents,
      e.external_cents ?? '',
      e.at,
    ];
    const payload = e.hash_version === 2 ? JSON.stringify([2, e.id, ...fields]) : fields.join('|');
    return createHash('sha256').update(payload).digest('hex');
  }
  ledgerHead() {
    const tip = this.db.prepare('SELECT id,hash FROM ledger ORDER BY id DESC LIMIT 1').get();
    const { count } = this.db.prepare('SELECT COUNT(*) AS count FROM ledger').get();
    return { count, tipId: tip?.id ?? 0, tipHash: tip?.hash ?? null };
  }

  bindCurrency(currency) {
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Devise invalide');
    const previous = this.db
      .prepare('SELECT value FROM ledger_meta WHERE key=?')
      .get('currency')?.value;
    const count = this.ledgerHead().count;
    if (count) {
      if (previous && previous !== currency)
        throw new Error('Devise du ledger incompatible : conversion non prise en charge');
      if (!previous) {
        const rows = this.db
          .prepare('SELECT DISTINCT r.data FROM runs r JOIN ledger l ON l.run_id=r.id')
          .all();
        if (rows.some((r) => (JSON.parse(r.data).plan?.cost?.currency ?? 'EUR') !== currency))
          throw new Error('Devise historique du ledger incompatible');
      }
    }
    this.db
      .prepare(
        'INSERT INTO ledger_meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      )
      .run('currency', currency);
  }
  charge(id, dimension, units, cents = 0, external = null, currency = null) {
    if (!Object.hasOwn(meters, dimension)) throw new Error('Mètre inconnu');
    if (!Number.isFinite(units) || units <= 0 || units > Number.MAX_SAFE_INTEGER)
      throw new Error('Unités invalides');
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Coût invalide');
    if (!meters[dimension].billable && cents !== 0) throw new Error('Mètre non facturable');
    if (external !== null && (!Number.isSafeInteger(external) || external < 0))
      throw new Error('Coût externe invalide');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (currency) this.bindCurrency(currency);
      const missionStart = !this.db.prepare('SELECT 1 FROM ledger WHERE run_id=? LIMIT 1').get(id);
      const check =
        missionStart || ++this.chargesSinceFullCheck >= this.ledgerFullEvery
          ? this.verifyLedger()
          : this.verifyLedgerTail();
      if (missionStart || this.chargesSinceFullCheck >= this.ledgerFullEvery)
        this.chargesSinceFullCheck = 0;
      if (!check.ok) throw new Error('Intégrité du ledger invalide');
      // 0 or absent = no per-run cap (the monthly cap still applies); only a positive budget is a ceiling.
      // A malformed value is an integrity problem, reported apart from a real overrun.
      const budget = this.get(id)?.budgetCents ?? 0;
      if (!Number.isSafeInteger(budget) || budget < 0)
        throw new Error('Valeur illisible : budgetCents du run');
      if (budget > 0) {
        // The budget is summed over this run's rows only once each of them is proven unaltered.
        const { spent, last } = this.db
          .prepare(
            'SELECT COALESCE(SUM(platform_cents),0) AS spent, COALESCE(MAX(id),0) AS last FROM ledger WHERE run_id=?',
          )
          .get(id);
        const known = this.runSums.get(id);
        if (!known || known.spent !== spent || known.last !== last) {
          if (!this.verifyRunLedger(id).ok) throw new Error('Intégrité du ledger invalide');
          this.runSums.set(id, { spent, last });
        }
        if (spent + cents > budget) throw new Error('Budget plateforme dépassé');
      }
      if (this.limits.monthlyCapCents !== null && cents > 0) {
        const month = new Date().toISOString().slice(0, 7);
        const { total } = this.db
          .prepare(
            'SELECT COALESCE(SUM(platform_cents),0) AS total FROM ledger WHERE substr(at,1,7)=?',
          )
          .get(month);
        if (total + cents > this.limits.monthlyCapCents) throw new Error('Plafond mensuel dépassé');
      }
      const prev =
        this.db.prepare('SELECT hash FROM ledger ORDER BY id DESC LIMIT 1').get()?.hash ?? null;
      const entry = {
        run_id: id,
        dimension,
        units,
        platform_cents: cents,
        external_cents: external,
        at: new Date().toISOString(),
        hash_version: 2,
      };
      const inserted = this.db
        .prepare(
          'INSERT INTO ledger(run_id,dimension,units,platform_cents,external_cents,at,prev_hash,hash,hash_version) VALUES (?,?,?,?,?,?,?,?,?)',
        )
        .run(id, dimension, units, cents, external, entry.at, prev, null, 2);
      entry.id = Number(inserted.lastInsertRowid);
      this.db
        .prepare('UPDATE ledger SET hash=? WHERE id=?')
        .run(Store.entryHash(prev, entry), entry.id);
      this.db
        .prepare('UPDATE ledger_meta SET value=? WHERE key=?')
        .run(JSON.stringify(this.ledgerHead()), 'anchor');
      this.db.exec('COMMIT');
      const known = this.runSums.get(id);
      if (known) this.runSums.set(id, { spent: known.spent + cents, last: entry.id });
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  // Incremental check used on every charge/poll: the last verified row is unchanged, and the rows
  // added since chain from it ; then the anchor. An old edit is caught by the full check (startup,
  // first charge of a mission, every `ledgerFullEvery` charges) or, for a run with a budget, by
  // verifyRunLedger() before its budget is summed.
  verifyLedgerTail() {
    if (!this.startupLedger.ok) return this.startupLedger;
    if (this.ledgerBroken) return this.ledgerBroken;
    if (!this.verifiedTip) return this.verifyLedger();
    const tip = this.verifiedTip;
    if (tip.id) {
      const row = this.db.prepare('SELECT hash FROM ledger WHERE id=?').get(tip.id);
      if (!row || row.hash !== tip.hash) return this.markBroken({ ok: false, brokenAt: tip.id });
    }
    const walked = Store.walkLedger(
      this.db.prepare('SELECT * FROM ledger WHERE id>? ORDER BY id').iterate(tip.id),
      tip,
    );
    if (!walked.ok) return this.markBroken(walked);
    this.verifiedTip = walked.tip;
    return this.anchorMatches();
  }
  markBroken(result) {
    this.ledgerBroken = result;
    return result;
  }
  // Every row of one run, re-hashed and linked to the row that really precedes it.
  verifyRunLedger(id) {
    if (!this.startupLedger.ok) return this.startupLedger;
    if (this.ledgerBroken) return this.ledgerBroken;
    const rows = this.db
      .prepare(
        'SELECT l.*, (SELECT p.hash FROM ledger p WHERE p.id<l.id ORDER BY p.id DESC LIMIT 1) AS actual_prev FROM ledger l WHERE l.run_id=? ORDER BY l.id',
      )
      .all(id);
    for (const e of rows) {
      if (![1, 2].includes(e.hash_version)) return this.markBroken({ ok: false, brokenAt: e.id });
      if (e.hash === null) {
        if (e.hash_version !== 1) return this.markBroken({ ok: false, brokenAt: e.id });
        continue;
      }
      if (e.prev_hash !== (e.actual_prev ?? null) || Store.entryHash(e.prev_hash, e) !== e.hash)
        return this.markBroken({ ok: false, brokenAt: e.id });
    }
    return { ok: true };
  }
  // Walks rows in id order from a verified point ({ id, hash, chained }).
  static walkLedger(rows, from) {
    let prev = from.hash;
    let chained = from.chained;
    let id = from.id;
    for (const e of rows) {
      if (![1, 2].includes(e.hash_version)) return { ok: false, brokenAt: e.id };
      if (e.hash === null) {
        if (e.hash_version !== 1) return { ok: false, brokenAt: e.id };
        if (chained) return { ok: false, brokenAt: e.id }; // unchained row after the chain began
        id = e.id;
        continue; // legacy rows written before chaining
      }
      chained = true;
      if (e.prev_hash !== prev || Store.entryHash(prev, e) !== e.hash)
        return { ok: false, brokenAt: e.id };
      prev = e.hash;
      id = e.id;
    }
    return { ok: true, tip: { id, hash: prev, chained } };
  }
  anchorMatches() {
    try {
      const anchor = JSON.parse(
        this.db.prepare('SELECT value FROM ledger_meta WHERE key=?').get('anchor')?.value ?? 'null',
      );
      if (!anchor || JSON.stringify(anchor) !== JSON.stringify(this.ledgerHead()))
        return { ok: false, brokenAt: anchor?.tipId ?? 0 };
    } catch {
      return { ok: false, brokenAt: 0 };
    }
    return { ok: true };
  }
  // Recomputes the whole chain; returns the first broken entry id, if any.
  verifyLedger() {
    const walked = Store.walkLedger(this.db.prepare('SELECT * FROM ledger ORDER BY id').iterate(), {
      id: 0,
      hash: null,
      chained: false,
    });
    if (!walked.ok) return this.markBroken(walked);
    this.verifiedTip = walked.tip;
    return this.anchorMatches();
  }
  usage(id) {
    const entries = this.db
      .prepare(
        'SELECT id,run_id,dimension,units,platform_cents,external_cents,at FROM ledger WHERE run_id=? ORDER BY id',
      )
      .all(id);
    return {
      platformCents: entries.reduce((n, r) => n + r.platform_cents, 0),
      externalCents: null,
      entries,
    };
  }
  close() {
    this.db.close();
  }
}
