import { validateWorkflow, levels } from './definition.js';
export { validateWorkflow, levels, stepKinds, workflowSchema } from './definition.js';

// Durable DAG scheduler on the platform SQLite store. Each step row records its state, attempt and
// generation; a result is accepted only if its generation is still current, so a late answer from
// an abandoned attempt can never overwrite a newer one.
export const stepStates = [
  'pending',
  'running',
  'waiting_approval',
  'succeeded',
  'failed',
  'skipped',
  'cancelled',
  'uncertain',
];
const finished = new Set(['succeeded', 'failed', 'skipped', 'cancelled']);
const MAX_OUTPUT = 200000;

export class StepTimeoutError extends Error {
  constructor(stepId, ms) {
    super(`Étape ${stepId} : délai de ${ms} ms dépassé`);
    this.code = 'timeout';
  }
}

export class WorkflowEngine {
  constructor({ store, executors = {}, now = () => new Date().toISOString() }) {
    Object.assign(this, { store, executors, now });
    this.db = store.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS workflow_steps(
      run_id TEXT NOT NULL REFERENCES runs(id), step_id TEXT NOT NULL, state TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 0, generation INTEGER NOT NULL DEFAULT 0,
      output TEXT, error TEXT, started_at TEXT, finished_at TEXT, PRIMARY KEY(run_id, step_id))`);
    this.wakers = new Map();
  }
  steps(runId) {
    return this.db
      .prepare('SELECT * FROM workflow_steps WHERE run_id=? ORDER BY rowid')
      .all(runId)
      .map((r) => ({ ...r, output: r.output ? JSON.parse(r.output) : null }));
  }
  row(runId, stepId) {
    const r = this.db
      .prepare('SELECT * FROM workflow_steps WHERE run_id=? AND step_id=?')
      .get(runId, stepId);
    return r ? { ...r, output: r.output ? JSON.parse(r.output) : null } : null;
  }
  set(runId, stepId, patch, event = true) {
    const keys = Object.keys(patch);
    const values = keys.map((k) =>
      k === 'output' && patch[k] !== null ? JSON.stringify(patch[k]) : patch[k],
    );
    this.db
      .prepare(
        `UPDATE workflow_steps SET ${keys.map((k) => `${k}=?`).join(',')} WHERE run_id=? AND step_id=?`,
      )
      .run(...values, runId, stepId);
    if (event && patch.state) {
      const r = this.row(runId, stepId);
      this.store.event(runId, 'step', {
        stepId,
        state: r.state,
        attempt: r.attempt,
        error: r.error ?? null,
      });
    }
  }
  init(runId, workflow) {
    const wf = validateWorkflow(workflow);
    const insert = this.db.prepare(
      "INSERT INTO workflow_steps(run_id, step_id, state) VALUES (?, ?, 'pending')",
    );
    for (const s of wf.steps) insert.run(runId, s.id);
    this.store.event(runId, 'workflow', {
      id: wf.id,
      title: wf.title,
      levels: levels(wf),
      steps: wf.steps.map(({ id, title, kind, dependsOn, agent, effect, optional }) => ({
        id,
        title,
        kind,
        dependsOn,
        agent: agent ?? null,
        effect,
        optional,
      })),
    });
    return wf;
  }
  // After a crash: read-only steps that were running are retried; write steps become `uncertain`
  // and wait for a human decision, because their external effect may already have happened.
  recover(runId, workflow) {
    const wf = validateWorkflow(workflow);
    for (const s of wf.steps) {
      const r = this.row(runId, s.id);
      if (!r) throw new Error(`Étape inconnue pour ce run : ${s.id}`);
      if (r.state === 'running')
        this.set(runId, s.id, {
          state: s.effect === 'write' ? 'uncertain' : 'pending',
          error: 'Interrompue par un arrêt du serveur',
        });
    }
    return wf;
  }
  wake(runId) {
    this.wakers.get(runId)?.();
  }
  approve(runId, stepId, approved, note = '') {
    const r = this.row(runId, stepId);
    if (r?.state !== 'waiting_approval')
      throw new Error('Aucune approbation en attente pour cette étape');
    this.set(runId, stepId, {
      state: approved ? 'succeeded' : 'failed',
      output: { approved: !!approved, note: String(note).slice(0, 500) },
      error: approved ? null : 'Refusée par l’utilisateur',
      finished_at: this.now(),
    });
    this.wake(runId);
  }
  resolveUncertain(runId, stepId, action) {
    const r = this.row(runId, stepId);
    if (r?.state !== 'uncertain') throw new Error('Étape non incertaine');
    const patch = {
      retry: { state: 'pending', error: null },
      done: { state: 'succeeded', output: { confirmedByUser: true }, finished_at: this.now() },
      fail: {
        state: 'failed',
        error: 'Marquée en échec par l’utilisateur',
        finished_at: this.now(),
      },
    }[action];
    if (!patch) throw new Error('Action inconnue');
    this.set(runId, stepId, patch);
    this.wake(runId);
  }
  // Drives the DAG until every step is final, or until cancellation. Resolves with the run outcome.
  async drive(runId, workflow, context = {}, signal) {
    const wf = validateWorkflow(workflow);
    const byId = new Map(wf.steps.map((s) => [s.id, s]));
    const running = new Map();
    let wakeResolve;
    const newWake = () =>
      new Promise((r) => {
        wakeResolve = r;
        this.wakers.set(runId, r);
      });
    let wakePromise = newWake();
    const onAbort = () => wakeResolve?.();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      for (;;) {
        if (signal?.aborted) {
          for (const s of wf.steps) {
            const st = this.row(runId, s.id).state;
            if (!finished.has(st))
              this.set(runId, s.id, {
                state: st === 'running' && s.effect === 'write' ? 'uncertain' : 'cancelled',
                error: 'Annulée',
                finished_at: this.now(),
              });
          }
          await Promise.allSettled(running.values());
          return this.outcome(runId, wf, true);
        }
        const rows = new Map(this.steps(runId).map((r) => [r.step_id, r]));
        const satisfied = (d) =>
          rows.get(d).state === 'succeeded' ||
          (byId.get(d).optional && ['failed', 'skipped'].includes(rows.get(d).state));
        const blocking = (d) =>
          ['failed', 'skipped', 'cancelled'].includes(rows.get(d).state) && !satisfied(d);
        let changed = false;
        for (const s of wf.steps) {
          if (rows.get(s.id).state !== 'pending') continue;
          if (s.dependsOn.some(blocking)) {
            this.set(runId, s.id, {
              state: 'skipped',
              error: 'Dépendance en échec',
              finished_at: this.now(),
            });
            changed = true;
          }
        }
        if (changed) continue;
        const ready = wf.steps.filter(
          (s) =>
            rows.get(s.id).state === 'pending' &&
            !running.has(s.id) &&
            s.dependsOn.every(satisfied),
        );
        for (const s of ready) {
          if (running.size >= wf.concurrency) break;
          if (s.kind === 'approval') {
            this.set(runId, s.id, { state: 'waiting_approval', started_at: this.now() });
            continue;
          }
          const inputs = Object.fromEntries(s.dependsOn.map((d) => [d, rows.get(d).output]));
          running.set(
            s.id,
            this.launch(runId, s, inputs, context, signal).finally(() => {
              running.delete(s.id);
              wakeResolve?.();
            }),
          );
        }
        const states = this.steps(runId).map((r) => r.state);
        const waiting = states.some((st) => st === 'waiting_approval' || st === 'uncertain');
        if (!running.size && !waiting && states.every((st) => finished.has(st)))
          return this.outcome(runId, wf, false);
        if (!running.size && !waiting && !ready.length && states.includes('pending'))
          throw new Error('Workflow bloqué : aucune étape exécutable');
        await wakePromise;
        wakePromise = newWake();
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
      this.wakers.delete(runId);
    }
  }
  async launch(runId, step, inputs, context, signal) {
    const prev = this.row(runId, step.id);
    const generation = prev.generation + 1;
    const attempt = prev.attempt + 1;
    this.set(runId, step.id, {
      state: 'running',
      attempt,
      generation,
      error: null,
      started_at: this.now(),
    });
    const executor = this.executors[step.kind];
    const local = new AbortController();
    const onAbort = () => local.abort(signal.reason ?? new Error('Annulée'));
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = step.timeoutMs
      ? setTimeout(() => local.abort(new StepTimeoutError(step.id, step.timeoutMs)), step.timeoutMs)
      : null;
    try {
      if (!executor) throw new Error(`Aucun exécuteur pour les étapes ${step.kind}`);
      const aborted = new Promise((_, reject) =>
        local.signal.addEventListener('abort', () => reject(local.signal.reason), { once: true }),
      );
      aborted.catch(() => {});
      const output = await Promise.race([
        executor(step, { runId, inputs, context, signal: local.signal, attempt }),
        aborted,
      ]);
      const encoded = JSON.stringify(output ?? null);
      if (encoded.length > MAX_OUTPUT) throw new Error(`Sortie de ${step.id} trop volumineuse`);
      if (!this.current(runId, step.id, generation)) return;
      this.set(runId, step.id, {
        state: 'succeeded',
        output: output ?? null,
        finished_at: this.now(),
      });
    } catch (e) {
      if (!this.current(runId, step.id, generation)) return;
      if (signal?.aborted) return; // drive() marks cancellation
      const message = String(e?.message ?? e).slice(0, 1000);
      if (step.effect === 'write' && e?.code === 'timeout')
        this.set(runId, step.id, { state: 'uncertain', error: message });
      else if (attempt <= step.retries)
        this.set(runId, step.id, { state: 'pending', error: `Tentative ${attempt} : ${message}` });
      else this.set(runId, step.id, { state: 'failed', error: message, finished_at: this.now() });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  current(runId, stepId, generation) {
    const r = this.row(runId, stepId);
    return r && r.generation === generation && r.state === 'running';
  }
  outcome(runId, wf, cancelled) {
    const rows = new Map(this.steps(runId).map((r) => [r.step_id, r]));
    const failedRequired = wf.steps.filter(
      (s) => !s.optional && rows.get(s.id).state !== 'succeeded',
    );
    const state = cancelled ? 'cancelled' : failedRequired.length ? 'failed' : 'completed';
    return {
      state,
      outputs: Object.fromEntries(wf.steps.map((s) => [s.id, rows.get(s.id).output])),
      failed: failedRequired.map((s) => ({
        id: s.id,
        state: rows.get(s.id).state,
        error: rows.get(s.id).error,
      })),
    };
  }
}
