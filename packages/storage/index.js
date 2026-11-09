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
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
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
    this.db
      .prepare('INSERT OR IGNORE INTO ledger_meta VALUES (?,?)')
      .run('anchor', JSON.stringify(this.ledgerHead()));
    this.limits = { monthlyCapCents: null };
    // Full chain check once at startup (cost linear, paid once); each charge then only checks the tail.
    this.startupLedger = this.verifyLedger();
    for (const { data } of this.db.prepare('SELECT data FROM runs').all()) {
      const run = JSON.parse(data);
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
    this.emit(id, event);
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
      if (!this.verifyLedgerTail().ok) throw new Error('Intégrité du ledger invalide');
      // 0 or absent = no per-run cap (the monthly cap still applies); only a positive budget is a ceiling.
      // A malformed value is an integrity problem, reported apart from a real overrun.
      const budget = this.get(id)?.budgetCents ?? 0;
      if (!Number.isSafeInteger(budget) || budget < 0)
        throw new Error('Valeur illisible : budgetCents du run');
      if (budget > 0) {
        const { spent } = this.db
          .prepare('SELECT COALESCE(SUM(platform_cents),0) AS spent FROM ledger WHERE run_id=?')
          .get(id);
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
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  // Constant-time check used on every charge/poll: the last row against its predecessor, and the
  // anchor. An old edit is caught by the startup check or by verifyLedger() (full), not here.
  verifyLedgerTail() {
    if (!this.startupLedger.ok) return this.startupLedger;
    const rows = this.db.prepare('SELECT * FROM ledger ORDER BY id DESC LIMIT 2').all();
    const [tip, before] = rows;
    if (tip) {
      if (![1, 2].includes(tip.hash_version)) return { ok: false, brokenAt: tip.id };
      if (tip.hash === null) {
        if (tip.hash_version !== 1) return { ok: false, brokenAt: tip.id };
      } else {
        const prev = before?.hash ?? null;
        if (tip.prev_hash !== prev || Store.entryHash(prev, tip) !== tip.hash)
          return { ok: false, brokenAt: tip.id };
      }
    }
    return this.anchorMatches();
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
    let prev = null;
    let chained = false;
    for (const e of this.db.prepare('SELECT * FROM ledger ORDER BY id').all()) {
      if (![1, 2].includes(e.hash_version)) return { ok: false, brokenAt: e.id };
      if (e.hash === null) {
        if (e.hash_version !== 1) return { ok: false, brokenAt: e.id };
        if (chained) return { ok: false, brokenAt: e.id }; // unchained row after the chain began
        continue; // legacy rows written before chaining
      }
      chained = true;
      if (e.prev_hash !== prev || Store.entryHash(prev, e) !== e.hash)
        return { ok: false, brokenAt: e.id };
      prev = e.hash;
    }
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
