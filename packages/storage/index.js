import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EventEmitter } from 'node:events';
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
    for (const run of this.list())
      if (!terminal.has(run.state))
        this.update(run.id, {
          state: 'interrupted',
          error: 'Serveur arrêté pendant l’exécution ; relancer explicitement.',
        });
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
  setSkill(id, value) {
    this.db
      .prepare('INSERT INTO skills VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .run(id, JSON.stringify(value));
  }
  charge(id, dimension, units, cents = 0, external = null) {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Coût invalide');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const spent = this.usage(id).platformCents;
      if (spent + cents > this.get(id).budgetCents) throw new Error('Budget plateforme dépassé');
      this.db
        .prepare(
          'INSERT INTO ledger(run_id,dimension,units,platform_cents,external_cents,at) VALUES (?,?,?,?,?,?)',
        )
        .run(id, dimension, units, cents, external, new Date().toISOString());
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  usage(id) {
    const entries = this.db.prepare('SELECT * FROM ledger WHERE run_id=? ORDER BY id').all(id);
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
