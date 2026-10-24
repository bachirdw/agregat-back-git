import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
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
    this.limits = { monthlyCapCents: null };
    for (const { data } of this.db.prepare('SELECT data FROM runs').all()) {
      const run = JSON.parse(data);
      if (!terminal.has(run.state))
        this.update(run.id, {
          state: 'interrupted',
          error: 'Serveur arrêté pendant l’exécution ; relancer explicitement.',
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
  event(id, type, data) {
    const at = new Date().toISOString();
    const encoded = JSON.stringify(data);
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
    return createHash('sha256')
      .update(
        [
          prev ?? '',
          e.run_id,
          e.dimension,
          e.units ?? '',
          e.platform_cents,
          e.external_cents ?? '',
          e.at,
        ].join('|'),
      )
      .digest('hex');
  }
  charge(id, dimension, units, cents = 0, external = null) {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Coût invalide');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const spent = this.usage(id).platformCents;
      if (spent + cents > this.get(id).budgetCents) throw new Error('Budget plateforme dépassé');
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
      };
      this.db
        .prepare(
          'INSERT INTO ledger(run_id,dimension,units,platform_cents,external_cents,at,prev_hash,hash) VALUES (?,?,?,?,?,?,?,?)',
        )
        .run(id, dimension, units, cents, external, entry.at, prev, Store.entryHash(prev, entry));
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  // Recomputes the whole chain; returns the first broken entry id, if any.
  verifyLedger() {
    let prev = null;
    let chained = false;
    for (const e of this.db.prepare('SELECT * FROM ledger ORDER BY id').all()) {
      if (e.hash === null) {
        if (chained) return { ok: false, brokenAt: e.id }; // unchained row after the chain began
        continue; // legacy rows written before chaining
      }
      chained = true;
      if (e.prev_hash !== prev || Store.entryHash(prev, e) !== e.hash)
        return { ok: false, brokenAt: e.id };
      prev = e.hash;
    }
    return { ok: true };
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
