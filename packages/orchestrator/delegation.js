// chef-01 (mode workflow, conception du 18/11, sprint 1) : the family of a mission whose owner
// accepted the workflow mode. Its agent, the chief, gets the mission tools (MCP server
// `relay-missions`, packages/mission-gateway/server.js) ; each call reaches `call()` here through
// POST /api/internal/missions/<mission>. A sub-mission (« fille ») is an ordinary mission created by
// Orchestrator.create() : same planning, same questions, same send cards, same Bilan.
//  - link : field `famille: { racine, mere, titre }` on the sub-mission's row ; the list of a
//    mother's sub-missions is read from the rows (store.children), no table of its own ; one level
//    only (plan v2 du 18/11) : a sub-mission never launches one ;
//  - envelope : `total` and `parallel` of the owner's acceptance ; beyond `parallel` a sub-mission
//    waits for its place (never an error), beyond `total` the owner is asked (question queue) ;
//  - the sub-missions hold none of the platform's three slots : the envelope bounds them, and
//    activity() counts every agent at work ; the family shares the private workspace ;
//  - the chief's own timers are paused while the platform waits for its sub-missions ;
//  - cancelling a mother cancels its sub-missions ; a restart leaves the whole family `interrupted`.
// delegation-v2-01 : the family is read (store.children) only for a mission that launched a
// sub-mission (`estMere` on its row, `mere` on its control) : a mission that delegates nothing
// reads nothing more. What a sub-mission gives back is read from the database and can be read
// again as often as needed (nothing is consumed).
// delegation-v2-01, partie B (plan v2, section 3) : the tools and the chief's sentence are lent to
// every mission led by an agent (never to a sub-mission ; AGENT_PLATFORM_DELEGATION=0 withdraws
// them from every mission). Lending obliges to nothing. The owner's acceptance comes from the
// request (`delegation.accepted`, the button), from the chief saying the owner's request asks for
// sub-agents (`demandeDuProprietaire`, no card), or from the card asked at the first launch (the
// sub-missions wait meanwhile) ; a refusal is final for the mission (`refus_proprietaire`). Nothing
// is written before the first mission_lancer.
import { randomUUID } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { detectAgents, loadProbes } from '../agent-runtime/index.js';
import { writeConfined } from '../policy-engine/files.js';
import { terminal } from '../storage/index.js';
import { ROOT } from './packs.js';
import { publicQuestion } from './questions.js';
import { readToolCall } from './tool-call.js';
import { familySection } from './family-bilan.js';
import {
  CONSENT_CHOICES,
  CONSENT_PENDING_NOTE,
  DAUGHTER_RULE,
  DEFAULT_ENVELOPE,
  ENVELOPE_EXTENSION,
  EXTENSION_CHOICES,
  MISSION_SERVER,
  MISSION_TOOLS,
  REFUSED_MESSAGE,
  REFUSED_CHILD,
  SYNTHESIS_TURN,
  chiefRule,
  consentLine,
  consentMessage,
  extensionMessage,
  promptNotice,
  synthesisMissed,
  waitSeconds,
} from './delegation-rule.js';

const MAX_ANSWER_CHARS = 50000;
const AGENTS_CACHE_MS = 60000;
const FILE_KINDS = new Set(['edit', 'delete', 'move']);
// A send card's event is stored with this title (packages/storage/index.js, `privatePreview`).
const SEND_CARD_TITLE = /^Envoi : aperçu privé/;
const SEND_LINE = /^Envoi par la plateforme : /;
const UNVERIFIED = 'non vérifié ; ne pas répéter avant vérification';
const fail = (erreur, message) => Object.assign(new Error(message), { erreur });
// A question of the platform answered by a choice (a form with titled options), never a free text.
const choiceQuestion = (message, choices) =>
  publicQuestion(
    randomUUID(),
    {
      message,
      requestedSchema: {
        type: 'object',
        properties: { choix: { type: 'string', title: 'Choix', oneOf: [...choices] } },
        required: ['choix'],
      },
    },
    new Date().toISOString(),
  );
const seconds = (from) => Math.max(0, Math.round((Date.now() - Date.parse(from)) / 1000));

export class Delegation {
  constructor(engine) {
    this.engine = engine;
    this.families = new Map(); // root mission id -> family kept in memory (queue, waiters)
    this.finals = new Map(); // sub-mission id -> { envois, fichiers } : cache of `child_done`
    this.briefs = new Map(); // sub-mission id -> { fichiers, soeurs } for its prompt
    this.agentsCache = null;
    // Read at start, as the other AGENT_PLATFORM_* settings : 0 withdraws tools and sentence.
    this.lent = process.env.AGENT_PLATFORM_DELEGATION !== '0';
  }
  get store() {
    return this.engine.store;
  }
  // A mission whose family may be read : it launched a sub-mission (now : `mere` on its control ;
  // before, or in an execution it resumes : `estMere` on its row). Nothing is read to know it.
  hasFamily(run) {
    return run?.estMere === true || this.engine.active.get(run?.id)?.mere === true;
  }
  // The owner's acceptance written on the mission : true, false (refused), or undefined (not yet).
  consent(row) {
    return row?.delegation?.accepted;
  }
  // A member of a family : a sub-mission, or a mission that launched one.
  member(id) {
    const run = this.store.get(id);
    return !!run?.famille || this.hasFamily(run);
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
      // review-delegation-v2-01 : let go once the mother has ended (and its sub-missions, see watch).
      const listener = (event) => {
        if (event.type !== 'state' || !terminal.has(event.data?.state)) return;
        this.store.off(rootId, listener);
        setImmediate(() => this.forget(family));
      };
      this.store.on(rootId, listener);
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
  held(id) {
    for (const family of this.families.values()) if (family.held.has(id)) return family;
    return null;
  }

  // ---- what an execution gets

  // The mission tools, for every mission led by an agent except a sub-mission (one level), through
  // the platform's internal bridge. Called only when an agent's session opens.
  servers(run) {
    if (!this.lent || run.famille) return [];
    const token = this.engine.approvalTokens.get(run.id);
    if (!this.engine.approvalBase || !token) {
      // Said only to an owner who accepted : any other mission stays as it was.
      if (run.delegation?.accepted === true)
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
  // What the prompt of an execution gets : the chief's sentence when the mission tools were lent
  // (`servers`, read from the run as created : nothing is read), a sub-mission's sentence and family.
  promptParts(run, servers = []) {
    if (servers.some((server) => server.name === MISSION_SERVER))
      return { fields: {}, rule: '\n' + chiefRule(run.delegation) };
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
  // delegation-v2-01 (plan v2, Codex 4) : the chief ends its turn while sub-missions live : the
  // platform waits for their end (the chief's timers paused), then the same session gets ONE more
  // turn with their results joined. Null when there is nothing to give (nothing is read for a
  // mission that launched none) or when the session is closed (the Bilan then says it).
  async synthesis(motherId, control, runtime) {
    if (!control?.mere) return null;
    const mother = this.store.get(motherId);
    const living = this.living(mother);
    if (!living.length) return null;
    const family = this.family(motherId);
    if (runtime.continueSession()) {
      await this.waitLiving(motherId, mother, control, family);
      if (!control.abort.signal.aborted && runtime.continueSession())
        return {
          familyResults: {
            nature: 'données rapportées par les sous-missions',
            terminees: living.map((child) => this.outcome(this.store.get(child.id))),
          },
          instructions: SYNTHESIS_TURN,
        };
    }
    this.missed(family, living);
    return null;
  }
  // Sub-missions whose results never reached the chief before its last answer.
  missed(family, children) {
    family.unsynthesized ??= new Set();
    for (const child of children) family.unsynthesized.add(child.famille?.titre ?? child.id);
  }
  living(mother) {
    return this.childrenOf(mother).filter((child) => !terminal.has(child.state));
  }
  waitLiving(motherId, mother, control, family) {
    this.store.event(motherId, 'family_waiting', { enCours: this.living(mother).length });
    control.suspendTimers?.();
    return this.until(family, () => !this.living(mother).length, control.abort.signal).finally(() =>
      control.resumeTimers?.(),
    );
  }
  // The chief has finished : the mother stays `running` (« attend ses sous-missions ») until its last
  // sub-mission ends, its timers paused : the platform waits, not the agent.
  async settle(motherId, control) {
    // Only an execution that launched a sub-mission may have one alive.
    if (!control?.mere) return;
    const mother = this.store.get(motherId);
    const family = this.family(motherId);
    family.closing = true;
    const living = this.living(mother);
    if (!living.length) return;
    // Their results reach no turn of the chief any more : the Bilan says it.
    this.missed(family, living);
    await this.waitLiving(motherId, mother, control, family);
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
  // The Bilan's « Sous-missions » section of a mother (empty without sub-mission) : how the owner
  // accepted (or refused), the sub-missions, and the results that never reached the chief.
  bilanSection(run, { chiefAnswer = '', motherSends = 0 } = {}) {
    if (!this.hasFamily(run)) return '';
    const mother = this.store.get(run.id);
    if (!mother) return '';
    // A sub-mission cancelled by the owner's refusal never ran : the refusal line says it.
    const children = this.childrenOf(mother).filter((child) => child.error !== REFUSED_CHILD);
    const accord = consentLine(mother.delegation);
    if (!children.length) return mother.delegation?.accepted === false ? '\n' + accord : '';
    const missed = [...(this.families.get(run.id)?.unsynthesized ?? [])];
    return familySection({
      accord,
      synthese: missed.length ? synthesisMissed(missed) : '',
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
  failureSection(run, control) {
    const section = this.bilanSection(run, { motherSends: control?.sendsApproved ?? 0 });
    if (!section) return;
    const row = this.store.get(run.id);
    const result = row.result ?? { simulated: !!row.simulated, summary: 'Bilan', evidence: [] };
    this.store.update(run.id, { result: { ...result, summary: result.summary + section } });
  }
  // The Bilan of a sub-mission as the platform wrote it (its own lines, without the answer).
  bilanOf(child) {
    const notes = child.result?.platformNotes;
    const text = Array.isArray(notes) ? notes.join('\n') : String(child.result?.summary ?? '');
    const cause = child.error && !text.includes(child.error) ? `- Cause : ${child.error}` : '';
    return [text, cause].filter(Boolean).join('\n');
  }
  // What the platform recorded when the sub-mission ended (`child_done` on its mother) : the
  // in-memory copy, or the database after a restart.
  doneOf(child) {
    const kept = this.finals.get(child.id);
    if (kept) return kept;
    const done = this.store
      .events(child.famille?.mere ?? '')
      .find((event) => event.type === 'child_done' && event.data?.childId === child.id);
    const fichiers = child.workspace
      ? this.engine.privateRunFile(child, 'fichiers')
      : done?.data?.fichiers;
    return { envois: done?.data?.envois, fichiers: Array.isArray(fichiers) ? fichiers : [] };
  }
  sendsOf(child) {
    return { approuves: 0, parAccord: 0, refuses: 0, incertains: 0, ...this.doneOf(child).envois };
  }
  // What the chief gets of a sub-mission's sends : the counters, the send line of its Bilan word
  // for word (uncertain ones included) ; without that line (it stopped before its Bilan), the send
  // events it recorded, unverified.
  sendsGiven(child) {
    const ligne = this.bilanOf(child)
      .split('\n')
      .find((text) => SEND_LINE.test(text));
    const envois = { ...this.sendsOf(child), ligne: ligne ?? null };
    if (ligne) return envois;
    const evenements = this.sendEvents(child.id);
    return evenements.length
      ? { ...envois, nonVerifies: { note: UNVERIFIED, evenements } }
      : envois;
  }
  sendEvents(id) {
    const events = this.store.events(id);
    const out = [];
    for (const event of events) {
      if (event.type === 'send_auto')
        out.push({
          type: 'accord_de_mission',
          capacite: event.data?.capability ?? null,
          cible: event.data?.target ?? null,
          at: event.at,
        });
      if (event.type !== 'permission' || !SEND_CARD_TITLE.test(event.data?.tool?.title ?? ''))
        continue;
      const resolved = events.find(
        (e) => e.type === 'permission_resolved' && e.data?.id === event.data.id,
      );
      const kind = event.data.options?.find(
        (option) => option.optionId === resolved?.data?.optionId,
      )?.kind;
      out.push({
        type: 'carte',
        issue: /^allow/.test(kind ?? '')
          ? 'approuvée'
          : /^reject/.test(kind ?? '')
            ? 'refusée'
            : 'sans réponse',
        at: event.at,
      });
    }
    return out;
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
      // The approved sends whose effect is not known (same counts as the Bilan's send line).
      incertains:
        (control?.sendsUncertain ?? 0) +
        (control?.sendCalls?.size ?? 0) +
        (control?.sendsBlocked?.size ?? 0),
    };
    const fichiers = [...(control?.familyFiles ?? [])].slice(0, 200);
    this.finals.set(child.id, { envois, fichiers });
    // A private mission keeps its file names in its own space, as its prompt ; any other mission
    // in the event, read again after a restart.
    if (child.workspace)
      try {
        writeConfined(child.cwd, `relay/runs/${child.id}-fichiers.json`, JSON.stringify(fichiers));
      } catch {
        /* The files then stay in memory only. */
      }
    this.store.event(child.famille.mere, 'child_done', {
      childId: child.id,
      state,
      envois,
      ...(child.workspace ? {} : { fichiers }),
    });
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
    // Held for the owner's card : nothing starts before the acceptance.
    if (this.consent(root) !== true) return;
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
  // A family whose mother and sub-missions have all ended is no longer kept in memory (nor the
  // copies of its sub-missions' records : the database keeps them).
  forget(family) {
    const root = this.store.get(family.rootId);
    if (!root || !terminal.has(root.state) || family.held.size || family.waiters.size) return;
    const children = this.childrenOf(root);
    if (children.some((child) => !terminal.has(child.state))) return;
    if (this.families.get(family.rootId) === family) this.families.delete(family.rootId);
    for (const child of children) {
      this.finals.delete(child.id);
      this.briefs.delete(child.id);
    }
  }

  // GET /api/runs/:id : `family` of a mother, absent for any other mission.
  view(run) {
    if (!this.hasFamily(run)) return {};
    const children = this.childrenOf(run);
    if (!children.length) return {};
    const { agents, enAttenteDuProprietaire } = this.activity();
    return {
      activity: { agents, awaitingOwner: enAttenteDuProprietaire },
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

  // Every agent at work on the machine (missions and sub-missions : the executions started), and
  // those waiting for the owner (a question, a card to click) : they hold none of the three slots.
  activity() {
    let agents = 0;
    let waiting = 0;
    for (const id of this.engine.active.keys()) {
      agents++;
      if (['awaiting_owner', 'waiting_permission'].includes(this.store.get(id)?.state)) waiting++;
    }
    return {
      agents,
      enAttenteDuProprietaire: waiting,
      texte: `${agents} agent(s) en activité (missions et sous-agents), dont ${waiting} en attente du propriétaire`,
    };
  }

  // ---- the tools (POST /api/internal/missions/<mother>)

  async call(motherId, token, body, signal) {
    const control = this.engine.active.get(motherId);
    if (!control || !token || this.engine.approvalTokens.get(motherId) !== token)
      return { status: 403, body: { error: 'Jeton invalide ou mission inactive' } };
    const mother = this.store.get(motherId);
    // The tools are never lent to a sub-mission, nor to any mission once withdrawn.
    if (!this.lent || !mother || mother.famille)
      return { status: 403, body: { error: 'Outils de mission non prêtés à cette mission' } };
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
      // review-delegation-v2-01 : a mere call creates no family ; an ended mother launches nothing.
      if (
        control.abort.signal.aborted ||
        terminal.has(mother.state) ||
        this.families.get(motherId)?.closing
      )
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
    // Refused by the owner (card, or the request) : the chief goes on alone ; nothing is asked again.
    if (this.consent(root) === false) throw fail('refus_proprietaire', REFUSED_MESSAGE);
    const { total, parallel } = this.envelope(root);
    const consigne = args.consigne.trim();
    const launched = this.childrenOf(mother).length + family.pending;
    if (launched >= total) {
      if (this.consent(root) === true) this.askExtension(mother, control, launched + 1, total);
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
    const privateTitle = !!mother.workspace && !this.engine.ownerMode;
    const titre = privateTitle
      ? `Sous-mission ${launched + 1}`
      : args.titre
        ? asked.slice(0, 80)
        : asked.slice(0, 60);
    const link = {
      link: {
        racine: mother.id,
        mere: mother.id,
        titre,
      },
      title: titre,
      cwd: mother.cwd,
    };
    // The first launch of this execution : an acceptance given with the request is written now
    // (nothing before : a mission that delegates nothing writes nothing) ; the chief saying the
    // owner's request asks for sub-agents is the owner's acceptance (voie 2 : a line, no card).
    if (!control.mere && this.consent(root) === true) this.acceptedEvent(root);
    else if (
      this.consent(root) !== true &&
      args.demandeDuProprietaire === true &&
      !family.consentAsked
    )
      this.accept(mother.id, 'prompt', promptNotice(root?.delegation));
    // From now on the family of this mission is read (and only now) : see hasFamily().
    control.mere = true;
    if (!mother.estMere) this.store.update(mother.id, { estMere: true });
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
    const consent = this.consent(this.store.get(mother.id));
    // Refused while this one was being created : it never starts.
    if (consent === false) {
      this.cancelHeld(run.id, REFUSED_CHILD);
      throw fail('refus_proprietaire', REFUSED_MESSAGE);
    }
    // No acceptance yet : the sub-mission waits, the owner gets the card (once).
    if (consent !== true) this.askConsent(mother, control);
    this.pump(family);
    const etat = this.heldState(run.id) ?? 'en_cours';
    return {
      id: run.id,
      titre,
      etat,
      agent,
      modele,
      famille: {
        lancees: this.childrenOf(mother).length,
        enCours: this.occupied(family),
        total,
        parallel,
      },
      ...(etat === 'attend_accord' ? { note: CONSENT_PENDING_NOTE } : {}),
    };
  }
  // The owner's acceptance, written on the mission (kept by its resumption) and in its thread.
  accept(motherId, via, message = null) {
    const row = this.store.get(motherId);
    const { total, parallel } = this.envelope(row);
    const delegation = {
      accepted: true,
      via,
      total,
      parallel,
      acceptedAt: new Date().toISOString(),
    };
    this.store.update(motherId, { delegation });
    this.acceptedEvent({ id: motherId, delegation }, message);
    const family = this.families.get(motherId);
    if (family) {
      this.pump(family);
      this.wake(family);
    }
  }
  acceptedEvent(row, message = null) {
    const { via, total, parallel, acceptedAt } = row.delegation;
    this.store.event(row.id, 'delegation_accepted', {
      via,
      total,
      parallel,
      acceptedAt: acceptedAt ?? null,
      ...(message ? { message } : {}),
    });
  }
  // Voie 3 (plan v2, 3.2) : the card of the first sub-mission, in the mother's question queue,
  // answered by a choice ; the chief is not blocked meanwhile (its sub-missions wait).
  askConsent(mother, control) {
    const family = this.family(mother.id);
    if (family.consentAsked) return;
    family.consentAsked = true;
    const row = this.store.get(mother.id);
    const question = choiceQuestion(consentMessage(row?.delegation), CONSENT_CHOICES);
    Promise.resolve(this.engine.enqueueQuestion(mother.id, question, control)).then((reply) => {
      const choice = reply?.action === 'accept' ? reply.content?.choix : null;
      if (choice === 'autoriser') return this.accept(mother.id, 'carte');
      // The mission ends meanwhile (or the question expired) : nothing is decided ; its waiting
      // sub-missions end with it, and a later launch asks again.
      if (reply?.action === 'cancel') {
        family.consentAsked = false;
        for (const id of [...family.held.keys()])
          this.cancelHeld(id, 'Accord des sous-agents resté sans réponse');
        return this.wake(family);
      }
      const current = this.store.get(mother.id);
      const { total, parallel } = this.envelope(current);
      this.store.update(mother.id, {
        delegation: { accepted: false, via: 'carte', total, parallel },
      });
      this.store.event(mother.id, 'delegation_declined', { via: 'carte' });
      for (const id of [...family.held.keys()]) this.cancelHeld(id, REFUSED_CHILD);
      this.wake(family);
    });
  }
  // Beyond the envelope the platform does not block in silence : it asks the owner, once at a time.
  askExtension(mother, control, nth, total) {
    const family = this.family(mother.id);
    if (family.asking) return;
    family.asking = true;
    this.store.event(mother.id, 'delegation_envelope_reached', { total, asked: nth });
    const question = choiceQuestion(extensionMessage(nth, total), EXTENSION_CHOICES);
    Promise.resolve(this.engine.enqueueQuestion(mother.id, question, control)).then((reply) => {
      family.asking = false;
      if (reply?.action !== 'accept' || reply.content?.choix !== 'oui') return;
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
  // A sub-mission held by the platform : waiting for the owner's card, or for its place.
  heldState(id) {
    const family = this.held(id);
    if (!family) return null;
    return this.consent(this.store.get(family.rootId)) === true ? 'en_file' : 'attend_accord';
  }
  line(child) {
    const held = this.heldState(child.id);
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
      etat: held ?? child.state,
      depuis: seconds(child.createdAt),
      inactiveDepuis: last ? seconds(last.at) : seconds(child.createdAt),
      attend: held
        ? held === 'en_file'
          ? 'place'
          : 'accord'
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
      fichiers: this.doneOf(child).fichiers,
      envois: this.sendsGiven(child),
      cause,
    };
  }
  // The agents installed, with the models each announced at its last session on this machine :
  // the same record as the « Modèle non annoncé » check of a mission (orchestrator plan()).
  async agents() {
    if (!this.agentsCache || Date.now() - this.agentsCache.at >= AGENTS_CACHE_MS)
      this.agentsCache = {
        at: Date.now(),
        list: (await detectAgents()).map((agent) => ({
          id: agent.id,
          disponible: !!(
            agent.installed &&
            agent.compatible &&
            (agent.simulated || this.engine.live)
          ),
        })),
      };
    const probes = loadProbes(this.engine.dataDir);
    return this.agentsCache.list.map((agent) => ({
      ...agent,
      modeles: (probes[agent.id]?.models?.options ?? []).map((model) => ({
        id: model.id,
        nom: model.name ?? model.id,
      })),
      modeleParDefaut: probes[agent.id]?.models?.current ?? null,
    }));
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
      activite: this.activity(),
      nature: 'données rapportées par les sous-missions',
    };
  }
  async wait(mother, control, { ids, toutes, delaiSecondes }, signal) {
    const children = this.childrenOf(mother);
    const known = new Set(children.map((child) => child.id));
    for (const id of ids ?? [])
      if (!known.has(id)) throw fail('introuvable', `Aucune sous-mission de cette mission : ${id}`);
    const targets = ids ?? [...known];
    const over = (id) => terminal.has(this.store.get(id)?.state) && !this.held(id);
    // Nothing is consumed (plan v2, Codex 2) : every call gives the whole state of the sub-missions
    // asked for, so an answer lost on the way is read again by the next call. Without `toutes`,
    // the call returns as soon as one of those still running when it started has ended.
    const running = targets.filter((id) => !over(id));
    const done = () => (toutes ? running.every(over) : running.some(over));
    let reached = false;
    if (running.length && !done()) {
      const family = this.family(mother.id);
      control.suspendTimers?.();
      control.runtime?.pauseDeadlines?.();
      family.waiting = (family.waiting ?? 0) + 1;
      try {
        reached = !(await this.untilOr(
          family,
          done,
          waitSeconds(delaiSecondes) * 1000,
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
    return {
      terminees: targets.filter(over).map((id) => this.outcome(this.store.get(id))),
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
    if (terminal.has(child.state)) return { id, etat: child.state };
    this.cancelOne(id, `Annulée par la mission mère${raison ? ` : ${raison}` : ''}`);
    return { id, etat: 'cancelled' };
  }

  // ---- cancellation, stop

  // Cancels the sub-missions still alive of a mother (one level) ; returns how many. Nothing is
  // read for a mission that launched none.
  cascade(id, reason = 'Annulée avec la mission mère') {
    if (!this.hasFamily({ id })) return 0;
    const living = this.store.children(id).filter((run) => !terminal.has(run.state));
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
