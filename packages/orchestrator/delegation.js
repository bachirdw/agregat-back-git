// chef-01 (mode workflow, conception du 18/11, sprint 1) : the family of a mission whose owner
// accepted the workflow mode. Its agent, the chief, gets the mission tools (MCP server
// `relay-missions`, packages/mission-gateway/server.js) ; each call reaches `call()` here through
// POST /api/internal/missions/<mission>. A sub-mission (« fille ») is an ordinary mission created by
// Orchestrator.create() : same planning, same questions, same send cards, same Bilan.
//  - link : field `famille: { racine, mere, profondeur, titre }` on the sub-mission's row ; the list
//    of a mother's sub-missions is read from the rows (store.children), no table of its own ;
//  - envelope : `total` and `parallel` of the owner's acceptance ; beyond `parallel` a sub-mission
//    waits for its place (never an error), beyond `total` the owner is asked (question queue) ;
//  - a family counts for one of the platform's slots and shares the private workspace ;
//  - the chief's own timers are paused while the platform waits for its sub-missions ;
//  - cancelling a mission cancels its descendants ; a restart leaves the whole family `interrupted`.
// Without the field `delegation`, none of this runs : no tool lent, no text added.
import { randomUUID } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { detectAgents } from '../agent-runtime/index.js';
import { terminal } from '../storage/index.js';
import { ROOT } from './packs.js';
import { proseQuestion } from './questions.js';
import { readToolCall } from './tool-call.js';
import { familySection } from './family-bilan.js';
import {
  DAUGHTER_RULE,
  DEFAULT_ENVELOPE,
  ENVELOPE_EXTENSION,
  MISSION_SERVER,
  MISSION_TOOLS,
  chiefRule,
  familyReminder,
} from './delegation-rule.js';

const MAX_ANSWER_CHARS = 50000;
const AGENTS_CACHE_MS = 60000;
const FILE_KINDS = new Set(['edit', 'delete', 'move']);
const fail = (erreur, message) => Object.assign(new Error(message), { erreur });
// « identique, au blanc près » : only the white space is not compared.
const sameWords = (a, b) =>
  String(a ?? '')
    .replace(/\s+/g, ' ')
    .trim() ===
  String(b ?? '')
    .replace(/\s+/g, ' ')
    .trim();
const seconds = (from) => Math.max(0, Math.round((Date.now() - Date.parse(from)) / 1000));

export class Delegation {
  constructor(engine) {
    this.engine = engine;
    this.families = new Map(); // root mission id -> family kept in memory (queue, waiters)
    this.reported = new Map(); // mother id -> sub-missions already given back by mission_attendre
    this.finals = new Map(); // sub-mission id -> { envois, fichiers } read when it ended
    this.briefs = new Map(); // sub-mission id -> { fichiers, soeurs } for its prompt
    this.agentsCache = null;
  }
  get store() {
    return this.engine.store;
  }
  // A mission whose agent is the chief : the owner accepted, and it is no sub-mission itself (the
  // first sprint lends the tools to mothers only).
  accepted(run) {
    return run?.delegation?.accepted === true && !run.famille;
  }
  member(id) {
    const run = this.store.get(id);
    return !!run?.famille || this.accepted(run);
  }
  envelope(root) {
    return {
      total: root?.delegation?.total ?? DEFAULT_ENVELOPE.total,
      parallel: root?.delegation?.parallel ?? DEFAULT_ENVELOPE.parallel,
    };
  }
  family(rootId) {
    let family = this.families.get(rootId);
    if (!family) {
      family = { rootId, held: new Map(), launched: new Set(), pending: 0, asking: false };
      family.waiters = new Set();
      this.families.set(rootId, family);
    }
    return family;
  }
  // The mother and the executions it resumes : a resumed chief sees the sub-missions of its chain.
  chain(mother) {
    const runs = [mother];
    const seen = new Set([mother.id]);
    let run = mother;
    while (run.resumedFrom && !seen.has(run.resumedFrom) && seen.size < 200) {
      run = this.store.get(run.resumedFrom);
      if (!run) break;
      seen.add(run.id);
      runs.push(run);
    }
    return runs;
  }
  childrenOf(mother) {
    return this.chain(mother).flatMap((run) => this.store.children(run.id));
  }
  ancestors(run) {
    const list = [];
    const seen = new Set();
    let current = run;
    while (current && !seen.has(current.id) && list.length < 50) {
      seen.add(current.id);
      list.push(current);
      current = current.famille?.mere ? this.store.get(current.famille.mere) : null;
    }
    return list;
  }
  // Every descendant of a mission, sub-missions of sub-missions included.
  descendants(id, seen = new Set()) {
    const out = [];
    for (const child of this.store.children(id)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child, ...this.descendants(child.id, seen));
    }
    return out;
  }
  held(id) {
    for (const family of this.families.values()) if (family.held.has(id)) return family;
    return null;
  }

  // ---- what an execution gets

  // Written on the mother when it is created : the owner's acceptance (or refusal), as given.
  created(run) {
    if (!run.delegation || run.famille) return;
    const { accepted, via, total, parallel, acceptedAt } = run.delegation;
    this.store.event(run.id, accepted ? 'delegation_accepted' : 'delegation_declined', {
      via,
      ...(accepted ? { total, parallel, acceptedAt: acceptedAt ?? null } : {}),
    });
  }
  // The mission tools, for a chief only, through the platform's internal bridge.
  servers(run) {
    if (!this.accepted(run)) return [];
    const token = this.engine.approvalTokens.get(run.id);
    if (!this.engine.approvalBase || !token) {
      this.store.event(run.id, 'delegation_unavailable', { reason: 'pont interne absent' });
      return [];
    }
    return [
      {
        name: MISSION_SERVER,
        command: process.execPath,
        args: [resolve(ROOT, 'packages/mission-gateway/server.js')],
        env: [
          {
            name: 'RELAY_MISSIONS_URL',
            value: `${this.engine.approvalBase}/api/internal/missions/${run.id}`,
          },
          { name: 'RELAY_APPROVAL_TOKEN', value: token },
        ],
      },
    ];
  }
  // What the prompt of an execution gets : nothing without a family.
  promptParts(run) {
    if (this.accepted(run))
      return { fields: {}, rule: '\n' + chiefRule(this.envelope(this.store.get(run.id) ?? run)) };
    if (!run?.famille) return { fields: {}, rule: '' };
    const mother = this.store.get(run.famille.mere);
    const brief = this.briefs.get(run.id) ?? {};
    return {
      fields: {
        famille: {
          demandeDuProprietaire: mother ? this.engine.turnObjective(mother) : null,
          mere: run.famille.mere,
          soeurs: brief.soeurs ?? [],
          fichiers: brief.fichiers ?? [],
        },
      },
      rule: '\n' + DAUGHTER_RULE,
    };
  }
  // The chief ends its turn while sub-missions live : one more turn, once (conception 2.5).
  reminder(motherId) {
    const mother = this.store.get(motherId);
    if (!this.accepted(mother)) return null;
    const living = this.living(mother);
    return living.length
      ? familyReminder(living.map((child) => child.famille?.titre ?? child.id))
      : null;
  }
  living(mother) {
    return this.childrenOf(mother).filter((child) => !terminal.has(child.state));
  }
  // The chief has finished : the mother stays `running` (« attend ses sous-missions ») until its last
  // sub-mission ends, its timers paused : the platform waits, not the agent.
  async settle(motherId, control) {
    const mother = this.store.get(motherId);
    if (!this.accepted(mother)) return;
    const family = this.family(motherId);
    family.closing = true;
    if (!this.living(mother).length) return;
    this.store.event(motherId, 'family_waiting', { enCours: this.living(mother).length });
    control.suspendTimers?.();
    try {
      await this.until(family, () => !this.living(mother).length, control.abort.signal);
    } finally {
      control.resumeTimers?.();
    }
  }
  // Resolves when `ready()` holds, the signal aborts or `ms` elapse (real clock : the delay of a
  // tool call, not one of the chief's guards). True when `ready()` holds.
  until(family, ready, ...signals) {
    return this.untilOr(family, ready, null, ...signals);
  }
  untilOr(family, ready, ms, ...signals) {
    if (ready()) return Promise.resolve(true);
    return new Promise((done) => {
      const live = signals.filter(Boolean);
      let timer = null;
      const finish = () => {
        family.waiters.delete(check);
        clearTimeout(timer);
        for (const signal of live) signal.removeEventListener('abort', finish);
        done(ready());
      };
      const check = () => ready() && finish();
      family.waiters.add(check);
      if (ms) timer = setTimeout(finish, ms);
      for (const signal of live)
        if (signal.aborted) return finish();
        else signal.addEventListener('abort', finish, { once: true });
    });
  }
  wake(family) {
    for (const check of [...family.waiters]) check();
  }
  // The Bilan's « Sous-missions » section of a mother (empty without sub-mission).
  bilanSection(motherId, { chiefAnswer = '', motherSends = 0 } = {}) {
    const mother = this.store.get(motherId);
    if (!mother) return '';
    const children = this.childrenOf(mother);
    if (!children.length) return '';
    return familySection({
      chiefAnswer,
      motherSends,
      children: children.map((child) => ({
        id: child.id,
        titre: child.famille?.titre ?? child.title ?? child.id,
        agent: child.agent,
        modele: child.model ?? '',
        state: this.held(child.id) ? 'queued' : child.state,
        durationMs:
          (child.finishedAt ? Date.parse(child.finishedAt) : Date.now()) -
          Date.parse(child.createdAt),
        bilan: this.bilanOf(child),
        envois: this.sendsOf(child),
      })),
    });
  }
  // A failed or cancelled mother keeps the section in its result too.
  failureSection(motherId, control) {
    const section = this.bilanSection(motherId, { motherSends: control?.sendsApproved ?? 0 });
    if (!section) return;
    const row = this.store.get(motherId);
    const result = row.result ?? { simulated: !!row.simulated, summary: 'Bilan', evidence: [] };
    this.store.update(motherId, { result: { ...result, summary: result.summary + section } });
  }
  // The Bilan of a sub-mission as the platform wrote it (its own lines, without the answer).
  bilanOf(child) {
    const notes = child.result?.platformNotes;
    const text = Array.isArray(notes) ? notes.join('\n') : String(child.result?.summary ?? '');
    const cause = child.error && !text.includes(child.error) ? `- Cause : ${child.error}` : '';
    return [text, cause].filter(Boolean).join('\n');
  }
  sendsOf(child) {
    const kept = this.finals.get(child.id)?.envois;
    if (kept) return kept;
    const done = this.store
      .events(child.famille?.mere ?? '')
      .find((event) => event.type === 'child_done' && event.data?.childId === child.id);
    return done?.data?.envois ?? { approuves: 0, parAccord: 0, refuses: 0 };
  }

  // ---- the sub-mission's own records

  // Files a sub-mission named in its own completed tool calls (never by date : two sisters work in
  // the same folder at the same time), and the file names its gateway reported.
  observe(control, cwd) {
    const calls = new Map();
    const files = new Set();
    const add = (path) => {
      if (typeof path !== 'string' || !path) return;
      const target = isAbsolute(path) ? resolve(path) : resolve(cwd, path);
      const inside = relative(cwd, target);
      files.add(inside && !inside.startsWith('..') && !isAbsolute(inside) ? inside : path);
    };
    control.familyFiles = files;
    control.familyObserve = (update) => {
      if (!['tool_call', 'tool_call_update'].includes(update?.sessionUpdate) || !update.toolCallId)
        return;
      let call = calls.get(update.toolCallId);
      if (!call) {
        if (calls.size >= 4000) return;
        call = { kind: null, tool: '', paths: new Set() };
        calls.set(update.toolCallId, call);
      }
      if (typeof update.kind === 'string') call.kind = update.kind;
      const { tool, input } = readToolCall(update);
      if (tool) call.tool = tool;
      for (const location of Array.isArray(update.locations) ? update.locations : [])
        if (typeof location?.path === 'string') call.paths.add(location.path);
      for (const key of ['file_path', 'notebook_path', 'path'])
        if (typeof input[key] === 'string') call.paths.add(input[key]);
      if (update.status !== 'completed') return;
      if (FILE_KINDS.has(call.kind) || call.tool === 'career_write')
        for (const p of call.paths) add(p);
    };
    control.familyOutcome = (body) => {
      if (body?.status !== 'completed') return;
      for (const key of ['produced', 'rendered', 'uploaded'])
        if (typeof body[key] === 'string' && /^[^/\\\0]{1,200}$/.test(body[key]))
          files.add(body[key]);
    };
  }
  // A sub-mission ended : what the platform counted is kept, its mother is told, the queue moves.
  ended(child, state) {
    const control = this.engine.active.get(child.id);
    const ownerApproved = (control?.sendsApproved ?? 0) - (control?.sendsGranted ?? 0);
    const envois = {
      approuves: control?.sendsApproved ?? 0,
      parAccord: control?.sendsGranted ?? 0,
      refuses: Math.max(0, (control?.sendsAsked ?? 0) - ownerApproved),
    };
    this.finals.set(child.id, {
      envois,
      fichiers: [...(control?.familyFiles ?? [])].slice(0, 200),
    });
    this.store.event(child.famille.mere, 'child_done', { childId: child.id, state, envois });
  }
  watch(child, family) {
    const listener = (event) => {
      if (event.type !== 'state') return;
      const state = event.data?.state;
      if (terminal.has(state)) {
        this.store.off(child.id, listener);
        this.ended(child, state);
      } else if (state !== 'queued')
        this.store.event(child.famille.mere, 'child_state', { childId: child.id, state });
      // A card asked right after this state is registered after it : the queue moves once it is.
      setImmediate(() => {
        this.pump(family);
        this.wake(family);
        this.forget(family);
      });
      this.wake(family);
    };
    this.store.on(child.id, listener);
  }
  // Places taken in the family : sub-missions started and not finished ; one waiting for the owner
  // (a question, or a final send in owner mode) holds none, as with the platform's three slots.
  occupied(family) {
    let n = 0;
    for (const id of family.launched) {
      const state = this.store.get(id)?.state;
      if (!state || terminal.has(state)) {
        family.launched.delete(id);
        continue;
      }
      if (state === 'awaiting_owner') continue;
      if (
        this.engine.ownerMode &&
        [...this.engine.permissions.values()].some(
          (p) => p.runId === id && p.actionClass === 'send',
        )
      )
        continue;
      n++;
    }
    return n;
  }
  pump(family) {
    const root = this.store.get(family.rootId);
    const { parallel } = this.envelope(root);
    while (family.held.size && this.occupied(family) < parallel) {
      const [id, entry] = family.held.entries().next().value;
      family.held.delete(id);
      if (terminal.has(this.store.get(id)?.state)) continue;
      family.launched.add(id);
      this.engine.active.set(id, entry.control);
      setImmediate(() => this.engine.launch(entry.run, entry.plan, entry.control, null));
    }
  }
  // A family whose mother and sub-missions have all ended is no longer kept in memory.
  forget(family) {
    const root = this.store.get(family.rootId);
    if (!root || !terminal.has(root.state) || family.held.size || family.waiters.size) return;
    if (this.living(root).length) return;
    this.families.delete(family.rootId);
    this.reported.delete(family.rootId);
  }

  // GET /api/runs/:id : `family` of a mother, absent for any other mission.
  view(run) {
    if (!run?.delegation || run.famille) return {};
    const children = this.childrenOf(run);
    if (!children.length) return {};
    return {
      family: children.map((child) => {
        const { titre, agent, etat, attend } = this.line(child);
        return {
          id: child.id,
          titre,
          agent,
          state: etat,
          attend,
          pendingQuestion: child.pendingQuestion ?? null,
          pendingPermission: this.engine.pendingPermission(child.id),
        };
      }),
    };
  }

  // ---- the tools (POST /api/internal/missions/<mother>)

  async call(motherId, token, body, signal) {
    const control = this.engine.active.get(motherId);
    if (!control || !token || this.engine.approvalTokens.get(motherId) !== token)
      return { status: 403, body: { error: 'Jeton invalide ou mission inactive' } };
    const mother = this.store.get(motherId);
    if (!this.accepted(mother))
      return { status: 403, body: { error: 'Mode workflow non accepté pour cette mission' } };
    const tool = MISSION_TOOLS[body?.tool];
    if (!tool)
      return {
        status: 400,
        body: { erreur: 'outil_inconnu', message: 'Outil de mission inconnu' },
      };
    const parsed = tool.schema.safeParse(body.args ?? {});
    if (!parsed.success)
      return {
        status: 200,
        body: {
          erreur: 'parametres_invalides',
          message: parsed.error.issues
            .slice(0, 5)
            .map((issue) => `${issue.path.join('.') || 'arguments'} — ${issue.message}`)
            .join(' ; '),
        },
      };
    // The call reached the platform : the chief's tool guard knows it is being served.
    control.toolDelivered?.(null, 'gateway');
    try {
      if (control.abort.signal.aborted || this.family(motherId).closing)
        throw fail('mission_terminee', 'La mission mère se termine ou est annulée');
      const handlers = {
        mission_lancer: () => this.launch(mother, control, parsed.data),
        mission_suivre: () => this.follow(mother, parsed.data),
        mission_attendre: () => this.wait(mother, control, parsed.data, signal),
        mission_annuler: () => this.cancelChild(mother, parsed.data),
      };
      return { status: 200, body: { result: await handlers[body.tool]() } };
    } catch (error) {
      return {
        status: 200,
        body: {
          erreur: error.erreur ?? 'erreur',
          message: String(error.message ?? error).slice(0, 500),
        },
      };
    }
  }

  async launch(mother, control, args) {
    const family = this.family(mother.id);
    const root = this.store.get(mother.id);
    const { total, parallel } = this.envelope(root);
    const consigne = args.consigne.trim();
    // The only true loop : handing oneself the very same task again.
    if (this.ancestors(mother).some((run) => sameWords(this.engine.turnObjective(run), consigne)))
      throw fail(
        'boucle',
        'Consigne identique à celle d’une mission ancêtre : la sous-mission referait la même mission.',
      );
    const launched = this.childrenOf(mother).length + family.pending;
    if (launched >= total) {
      this.askExtension(mother, control, launched + 1, total);
      throw fail(
        'enveloppe_atteinte',
        `Enveloppe acceptée par le propriétaire atteinte (${total} sous-missions) ; la plateforme lui demande s’il en autorise davantage.`,
      );
    }
    const fichiers = (args.fichiers ?? []).map((path) => path.replaceAll('\\', '/'));
    for (const path of fichiers)
      if (isAbsolute(path) || path.split('/').includes('..'))
        throw fail('fichier_hors_espace', `Chemin hors de l’espace de la mission : ${path}`);
    const agent = args.agent ?? mother.agent;
    const modele = args.modele ?? (agent === mother.agent ? (mother.model ?? '') : '');
    const asked = (args.titre ?? consigne).replace(/\s+/g, ' ').trim();
    const privateTitle = mother.workspace === 'career-ops' && !this.engine.ownerMode;
    const titre = privateTitle
      ? `Sous-mission ${launched + 1}`
      : args.titre
        ? asked.slice(0, 80)
        : asked.slice(0, 60);
    const link = {
      link: {
        racine: mother.famille?.racine ?? mother.id,
        mere: mother.id,
        profondeur: (mother.famille?.profondeur ?? 0) + 1,
        titre,
      },
      title: titre,
      cwd: mother.cwd,
    };
    family.pending++;
    let run;
    try {
      run = await this.engine.create(
        {
          prompt: consigne,
          agent,
          model: modele,
          pack: mother.pack,
          ...(mother.workspace ? { workspace: mother.workspace } : {}),
          skills: mother.skills ?? [],
          browser: mother.browser ?? 'auto',
          browserDomains: mother.browserDomains ?? [],
          budgetCents: mother.budgetCents ?? 0,
          agentMode: mother.agent === agent ? (mother.agentMode ?? '') : '',
        },
        null,
        link,
      );
    } catch (error) {
      const message = String(error?.issues ? 'Agent inconnu' : (error?.message ?? error));
      if (/Modèle non annoncé/.test(message)) throw fail('modele_inconnu', message);
      if (
        error?.issues ||
        /Agent non détecté|Adaptateur|Mode réel désactivé|Agent réel/.test(message)
      )
        throw fail('agent_indisponible', message);
      throw fail('erreur', message);
    } finally {
      family.pending--;
    }
    if (control.abort.signal.aborted) {
      // The mother ended while the sub-mission was planned : it never starts.
      this.store.update(run.id, {
        state: 'cancelled',
        error: 'Mission mère terminée avant le départ',
        finishedAt: new Date().toISOString(),
      });
      throw fail('mission_terminee', 'La mission mère se termine ou est annulée');
    }
    const soeurs = this.childrenOf(mother)
      .filter((child) => child.id !== run.id)
      .map((child) => child.famille?.titre ?? child.id);
    this.briefs.set(run.id, { fichiers, soeurs });
    this.observe(link.held.control, run.cwd);
    family.held.set(run.id, link.held);
    const child = this.store.get(run.id);
    this.watch(child, family);
    this.store.event(mother.id, 'child_launched', { childId: run.id, titre, agent, modele });
    this.pump(family);
    return {
      id: run.id,
      titre,
      etat: family.held.has(run.id) ? 'en_file' : 'en_cours',
      agent,
      modele,
      famille: {
        lancees: this.childrenOf(mother).length,
        enCours: this.occupied(family),
        total,
        parallel,
      },
    };
  }
  // Beyond the envelope the platform does not block in silence : it asks the owner, once at a time.
  askExtension(mother, control, nth, total) {
    const family = this.family(mother.id);
    if (family.asking) return;
    family.asking = true;
    this.store.event(mother.id, 'delegation_envelope_reached', { total, asked: nth });
    const question = proseQuestion(
      randomUUID(),
      {
        message: `Le chef veut lancer une ${nth}e sous-mission ; l’enveloppe acceptée est de ${total}. En autoriser ${ENVELOPE_EXTENSION} de plus ?`,
        options: ['oui', 'non'],
      },
      new Date().toISOString(),
    );
    Promise.resolve(this.engine.enqueueQuestion(mother.id, question, control)).then((reply) => {
      family.asking = false;
      const yes =
        reply?.action === 'accept' && /^\s*(?:oui|yes|ok)\b/i.test(String(reply.content?.reponse));
      if (!yes) return;
      const current = this.store.get(mother.id)?.delegation;
      if (!current) return;
      const extensions = [
        ...(current.extensions ?? []),
        { plus: ENVELOPE_EXTENSION, at: new Date().toISOString() },
      ];
      this.store.update(mother.id, {
        delegation: { ...current, total: current.total + ENVELOPE_EXTENSION, extensions },
      });
      this.store.event(mother.id, 'delegation_extended', {
        plus: ENVELOPE_EXTENSION,
        total: current.total + ENVELOPE_EXTENSION,
      });
    });
  }
  line(child) {
    const held = this.held(child.id);
    const events = this.store.events(child.id);
    const last = events.at(-1);
    const lastTool = [...events]
      .reverse()
      .find((event) => event.type === 'agent' && event.data?.sessionUpdate === 'tool_call');
    return {
      id: child.id,
      titre: child.famille?.titre ?? child.title,
      agent: child.agent,
      modele: child.model ?? '',
      etat: held ? 'en_file' : child.state,
      depuis: seconds(child.createdAt),
      inactiveDepuis: last ? seconds(last.at) : seconds(child.createdAt),
      attend: held
        ? 'place'
        : child.state === 'awaiting_owner'
          ? 'question'
          : this.engine.pendingPermission(child.id)
            ? 'carte_envoi'
            : null,
      outils: this.store.usage(child.id).entries.filter((e) => e.dimension === 'tool_observed')
        .length,
      dernierOutil: lastTool ? readToolCall(lastTool.data).tool.slice(0, 80) || null : null,
    };
  }
  // What a finished sub-mission gives back : its answer (data), its Bilan, its files, its sends.
  outcome(child) {
    const cause =
      child.state === 'completed'
        ? null
        : {
            type: /Limite d’usage/.test(child.error ?? '') ? 'limite_usage' : 'erreur',
            agent: child.agent,
            reprise: String(child.error ?? '').match(/réessayer à ([^.]{1,40})/)?.[1] ?? null,
            message: String(child.error ?? '').slice(0, 1000),
          };
    return {
      id: child.id,
      titre: child.famille?.titre ?? child.title,
      etat: child.state,
      reponse: this.engine.modelAnswerOf(child).slice(0, MAX_ANSWER_CHARS),
      bilan: this.bilanOf(child),
      fichiers: this.finals.get(child.id)?.fichiers ?? [],
      envois: (({ approuves, refuses }) => ({ approuves, refuses }))(this.sendsOf(child)),
      cause,
    };
  }
  async agents() {
    if (this.agentsCache && Date.now() - this.agentsCache.at < AGENTS_CACHE_MS)
      return this.agentsCache.list;
    const list = (await detectAgents()).map((agent) => ({
      id: agent.id,
      disponible: !!(agent.installed && agent.compatible && (agent.simulated || this.engine.live)),
    }));
    this.agentsCache = { at: Date.now(), list };
    return list;
  }
  async follow(mother, { id, details }) {
    const children = this.childrenOf(mother);
    const list = id ? children.filter((child) => child.id === id) : children;
    if (id && !list.length)
      throw fail('introuvable', 'Aucune sous-mission de cette mission avec cet id');
    return {
      missions: list.map((child) =>
        details && terminal.has(child.state)
          ? { ...this.line(child), ...this.outcome(child) }
          : this.line(child),
      ),
      agents: await this.agents(),
      nature: 'données rapportées par les sous-missions',
    };
  }
  async wait(mother, control, { ids, toutes, delaiSecondes }, signal) {
    const family = this.family(mother.id);
    const children = this.childrenOf(mother);
    const known = new Set(children.map((child) => child.id));
    for (const id of ids ?? [])
      if (!known.has(id)) throw fail('introuvable', `Aucune sous-mission de cette mission : ${id}`);
    const reported = this.reported.get(mother.id) ?? new Set();
    this.reported.set(mother.id, reported);
    const targets =
      ids ?? children.filter((child) => !reported.has(child.id)).map((child) => child.id);
    const over = (id) => terminal.has(this.store.get(id)?.state) && !this.held(id);
    // Asked by id : given back again ; without ids : each finished one once.
    const ready = () => targets.filter((id) => over(id) && (ids || !reported.has(id)));
    const done = () => (toutes ? targets.every(over) : ready().length > 0);
    let reached = false;
    if (!done() && targets.some((id) => !over(id))) {
      control.suspendTimers?.();
      control.runtime?.pauseDeadlines?.();
      family.waiting = (family.waiting ?? 0) + 1;
      try {
        reached = !(await this.untilOr(
          family,
          done,
          delaiSecondes * 1000,
          signal,
          control.abort.signal,
        ));
      } finally {
        family.waiting--;
        control.runtime?.resumeDeadlines?.();
        control.resumeTimers?.();
      }
    }
    if (control.abort.signal.aborted) throw fail('mission_terminee', 'La mission mère est arrêtée');
    const finished = ready();
    for (const id of finished) reported.add(id);
    return {
      terminees: finished.map((id) => this.outcome(this.store.get(id))),
      enCours: targets
        .filter((id) => !over(id))
        .map((id) => {
          const { titre, etat, attend } = this.line(this.store.get(id));
          return { id, titre, etat, attend };
        }),
      delaiAtteint: reached,
      nature: 'données rapportées par les sous-missions',
    };
  }
  async cancelChild(mother, { id, raison }) {
    const child = this.childrenOf(mother).find((run) => run.id === id);
    if (!child) throw fail('introuvable', 'Aucune sous-mission de cette mission avec cet id');
    if (terminal.has(child.state)) return { id, etat: child.state, descendants: 0 };
    const reason = `Annulée par la mission mère${raison ? ` : ${raison}` : ''}`;
    const descendants = this.cascade(id, reason);
    this.cancelOne(id, reason);
    return { id, etat: 'cancelled', descendants };
  }

  // ---- cancellation, stop

  // Cancels every descendant still alive of a mission ; returns how many.
  cascade(id, reason = 'Annulée avec la mission mère') {
    const living = this.descendants(id).filter((run) => !terminal.has(run.state));
    for (const run of living.reverse()) this.cancelOne(run.id, reason);
    return living.length;
  }
  cancelOne(id, reason) {
    if (this.cancelHeld(id, reason)) return;
    if (!this.engine.active.has(id)) return;
    try {
      this.engine.cancel(id, reason);
    } catch {
      /* Already ended meanwhile. */
    }
  }
  // A sub-mission waiting for its place : it never started, it ends here.
  cancelHeld(id, reason) {
    const family = this.held(id);
    if (!family) return false;
    family.held.delete(id);
    if (!terminal.has(this.store.get(id)?.state))
      this.store.update(id, {
        state: 'cancelled',
        error: reason,
        finishedAt: new Date().toISOString(),
      });
    return true;
  }
  // The platform stops : the sub-missions waiting for a place are interrupted with the others.
  close(reason) {
    for (const family of this.families.values())
      for (const id of [...family.held.keys()]) {
        family.held.delete(id);
        if (!terminal.has(this.store.get(id)?.state))
          this.store.update(id, {
            state: 'interrupted',
            error: reason,
            finishedAt: new Date().toISOString(),
          });
      }
  }
}
