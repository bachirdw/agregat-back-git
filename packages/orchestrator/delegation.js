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
// again as often as needed by mission_suivre with details ; mission_attendre gives it once in full
// (multi-agent-v3-02, D).
// delegation-v2-01, partie B (plan v2, section 3) : the tools and the chief's sentence are lent to
// a mission led by an agent (never to a sub-mission ; AGENT_PLATFORM_DELEGATION=0 withdraws
// them from every mission) ; multi-agent-v3-01 (D1) : only when its request carries
// `multiAgent: true` (the « Mode multi-agent » switch, off by default). Lending obliges to
// nothing. The owner's acceptance comes from the request (`delegation.accepted`, the button),
// from the chief saying the owner's request asks for sub-agents (`demandeDuProprietaire`, no
// card), or from the card asked at the first launch (the sub-missions wait meanwhile) ; a refusal
// is final for the mission (`refus_proprietaire`). Nothing is written before the first
// mission_lancer.
import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, rmdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { detectAgents, loadProbes } from '../agent-runtime/index.js';
// swarm-08 : the real state of an agent (swarm-02) and the hour of a limit, as the chief sees them.
import { agentState } from '../agent-runtime/agent-state.js';
import { limitReason } from '../agent-runtime/limits.js';
import { safeDirectory, writeConfined } from '../policy-engine/files.js';
import { terminal } from '../storage/index.js';
import { ROOT, packs } from './packs.js';
import { publicQuestion } from './questions.js';
import { readToolCall } from './tool-call.js';
import { familySection } from './family-bilan.js';
// swarm-01 : the chief's decision and the motives of its delegations (Bilan lines).
import { decisionLine, motifLine, readDecision } from './decision.js';
import { loadRoles, otherAgent, readVerdict, roleKey, roleList } from './roles.js';
import { continueChild, precedentOf, suiteTitle } from './continuation.js';
// equipe-carnet : the team notebook (packages/orchestrator/carnet.js).
import { Carnet } from './carnet.js';
import { CARNET_TOOLS } from './delegation-rule.js';
// swarm-10 : the result in the shape asked by the chief (tool resultat_rendre).
import { ResultatValide } from './resultat-valide.js';
import { RESULT_TOOLS } from './delegation-rule.js';
// swarm-15 : the durable lessons (module of swarm-03), served at start, kept, cited at the end.
import { Lecons, PORTEE_RE, ligneLecon } from './lecons.js';
import {
  CHIEF_CARNET,
  CHIEF_LECONS,
  DAUGHTER_CARNET,
  DAUGHTER_LECONS,
  LECON_MESSAGES,
  LECON_NATURE,
  LECON_TOOLS,
  leconsLine,
} from './delegation-rule.js';
// swarm-05 : doublons at launch and the living list of the other members.
import { partDe, trouverDoublon } from './doublon.js';
import { membres } from './soeurs.js';
// swarm-16 : the model tiers of a sub-mission (leger, standard, fort), resolved per agent.
import { getProfile } from '../agent-runtime/index.js';
import { avecNiveaux, choisirModele } from '../agent-runtime/niveaux.js';
import { niveauNonReconnu } from './delegation-rule.js';
// swarm-12 : the count per task, the dependants cancelled by a failure, the chief's messages never
// delivered, the short reminder of the owner's request (packages/orchestrator/taches.js).
import {
  MESSAGE_NON_REMIS,
  agregat,
  demandeCourte,
  dependantesAnnulees,
  dettes,
  messagesDuChef,
  MAX_EN_ATTENTE,
} from './taches.js';
import {
  CONSENT_CHOICES,
  CONSENT_PENDING_NOTE,
  DAUGHTER_MEMBRES,
  DEFAULT_ENVELOPE,
  ENVELOPE_EXTENSION,
  EXTENSION_CHOICES,
  MISSION_SERVER,
  MISSION_TOOLS,
  MOTHER_FAILED,
  REFUSED_MESSAGE,
  REFUSED_CHILD,
  SAME_AGENT_NOTE,
  SYNTHESIS_TURN,
  VERDICT_NOTE,
  VERDICT_TURN,
  agentReplaced,
  agentUnavailable,
  modelLimitReason,
  chiefRule,
  consentLine,
  doublonMessage,
  doublonNote,
  consentMessage,
  daughterRule,
  envelopeReached,
  envelopeReachedNoConsent,
  ENVELOPE_DECLINED,
  extensionMessage,
  motherFailedLine,
  prerequisiteFailed,
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
// multi-agent-v3-01 (D4) : a sub-mission counted in the envelope : any but the first two
// resumptions of a task.
const counts = (child) => !(child.famille?.reprise <= 2);
// swarm-01 : horsPerimetre and verification (famille.tache of the sub-mission).
const TASK_FIELDS = [
  'objectif',
  'informations',
  'perimetre',
  'resultatAttendu',
  'horsPerimetre',
  'verification',
];
const note = (texts) => (texts.some(Boolean) ? { note: texts.filter(Boolean).join(' ') } : {});
// swarm-08 : a usable agent (`disponible`) is ready, or refused more than 10 minutes ago (it is tried
// again) ; ready ones first, then those to try again, then the others (stable order).
const USABLE = { pret: 0, a_reessayer: 1 };
const rank = (agent) => USABLE[agent.etat] ?? 2;
// swarm-08 (relecture) : the models a probe announces, its well-formed entries only.
const optionsOf = (probe) => {
  const options = probe?.models?.options;
  return Array.isArray(options)
    ? options.filter((model) => model && typeof model === 'object')
    : [];
};
const seconds = (from) => Math.max(0, Math.round((Date.now() - Date.parse(from)) / 1000));
// swarm-12 : a new field of a result never makes it fail : on an unexpected error it is absent.
const sur = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

export class Delegation {
  constructor(engine) {
    this.engine = engine;
    this.families = new Map(); // root mission id -> family kept in memory (queue, waiters)
    this.finals = new Map(); // sub-mission id -> { envois, fichiers } : cache of `child_done`
    this.briefs = new Map(); // sub-mission id -> { fichiers, soeurs } for its prompt
    this.agentsCache = null;
    // swarm-08 : the clock of the agents' states (injected by the tests).
    this.now = () => Date.now();
    // Read at start, as the other AGENT_PLATFORM_* settings : 0 withdraws tools and sentence.
    this.lent = process.env.AGENT_PLATFORM_DELEGATION !== '0';
    // swarm-05 : AGENT_PLATFORM_DOUBLON : 0 (no check), signale (never a refusal), otherwise the
    // identical part is refused and the near one is said.
    this.doublon = { 0: 'off', signale: 'signale' }[process.env.AGENT_PLATFORM_DOUBLON] ?? 'refuse';
    // swarm-13 : AGENT_PLATFORM_VERDICT_TURN=0 withdraws the catch-up turn on a negative verdict
    // (and its joining to the synthesis turn) ; the Bilan line stays.
    this.rattrapage = process.env.AGENT_PLATFORM_VERDICT_TURN !== '0';
    this.carnet = new Carnet(this); // equipe-carnet
    this.resultats = new ResultatValide(this); // swarm-10
    // swarm-15 : AGENT_PLATFORM_LECONS=0 withdraws the lessons (neither field nor tool). The lessons
    // of the database's missions in <dataDir>/lecons ; a private mission's in its space (leconsDe).
    this.leconsOn = process.env.AGENT_PLATFORM_LECONS !== '0';
    this.lecons = this.leconsOn
      ? sur(() => new Lecons({ dir: join(engine.dataDir, 'lecons'), now: () => this.now() }))
      : null;
    this.leconsPrivees = new Map(); // space folder -> Lecons
    this.servies = new Map(); // execution id -> { ids, notees, citees, cite, magasin, portee }
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

  // The mission tools, for a mission led by an agent whose request turned the multi-agent mode on
  // (`multiAgent`, multi-agent-v3-01 D1), never for a sub-mission (one level), through the
  // platform's internal bridge. Called only when an agent's session opens.
  servers(run) {
    // equipe-carnet : a sub-mission of a multi-agent mother gets the notebook tools only.
    if (run.famille)
      return this.carnet.servers(run, {
        command: process.execPath,
        args: [resolve(ROOT, 'packages/mission-gateway/server.js')],
      });
    if (!this.lent || run.multiAgent !== true) return [];
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
          // swarm-15 : the gateway is a process of its own : the setting reaches it only here.
          ...(this.leconsOn ? [] : [{ name: 'AGENT_PLATFORM_LECONS', value: '0' }]),
        ],
      },
    ];
  }
  // What the prompt of an execution gets : the chief's sentence when the mission tools were lent
  // (`servers`, read from the run as created : nothing is read), a sub-mission's sentence and family.
  promptParts(run, servers = []) {
    if (servers.some((server) => server.name === MISSION_SERVER)) {
      // swarm-15 : the lessons of past missions (absent when none passes : prompt of before).
      const lecons = this.servir(run);
      const rule = chiefRule(run.delegation);
      if (!lecons) return { fields: {}, rule: '\n' + rule };
      return {
        fields: { lecons },
        rule:
          '\n' +
          (rule.includes(CHIEF_CARNET)
            ? rule.replace(CHIEF_CARNET, CHIEF_CARNET + CHIEF_LECONS)
            : `${rule} ${CHIEF_LECONS.replace(/ ; $/, '.')}`),
      };
    }
    if (!run?.famille) return { fields: {}, rule: '' };
    const lecons = this.servir(run); // swarm-15
    const mother = this.store.get(run.famille.mere);
    const brief = this.briefs.get(run.id) ?? {};
    const { apres, dossierResultats, relit } = run.famille;
    // equipe-01 (E2) : a suite gets the attempt it continues (data).
    const previous = run.famille.continue ? this.store.get(run.famille.continue) : null;
    const members = mother ? this.membersOf(run, mother) : [];
    // swarm-10 : the shape of its result (not for a verification role : its verdict has its own).
    const schemaResultat = this.resultats.verifier(run) ? null : brief.schemaResultat;
    return {
      fields: {
        famille: {
          // equipe-01 (E1) : its role in the team, and the sub-missions whose work it checks.
          ...(brief.role
            ? {
                role: brief.role.consigne
                  ? {
                      nom: brief.role.nom,
                      description: brief.role.description,
                      consigne: brief.role.consigne,
                    }
                  : { nom: brief.role.nom },
              }
            : {}),
          ...(relit ? { relit } : {}),
          ...(previous ? { precedent: precedentOf(this, previous) } : {}),
          demandeDuProprietaire: mother ? this.engine.turnObjective(mother) : null,
          mere: run.famille.mere,
          soeurs: brief.soeurs ?? [],
          // swarm-05 : the other members as they are now (absent when there is nobody).
          ...(members.length ? { membres: members } : {}),
          fichiers: brief.fichiers ?? [],
          // multi-agent-v3-01 (D8, D9, D3) : the structured task, the results folder, and the
          // results of its prerequisites (data, read only for a sub-mission that has some).
          ...(brief.tache ? { tache: brief.tache } : {}),
          ...this.carnet.forStart(run), // equipe-carnet : the notebook, absent while empty
          ...(lecons ? { lecons } : {}), // swarm-15 : absent when no lesson passes
          ...(dossierResultats ? { dossierResultats } : {}),
          ...(schemaResultat ? { schemaResultat } : {}),
          ...(apres
            ? {
                prerequis: apres.map((id) => {
                  const { titre, etat, reponse, fichiers } = this.outcome(this.store.get(id));
                  return { id, titre, etat, reponse, fichiers };
                }),
              }
            : {}),
        },
      },
      rule:
        '\n' +
        // swarm-05 : the sentence of the other members, only with famille.membres, on its own line
        // before the sub-mission's sentence (which stays the same, and last).
        (members.length ? DAUGHTER_MEMBRES.trimEnd() + '\n' : '') +
        // swarm-15 : the lessons' sentence right after the notebook's, only with famille.lecons.
        ((sentence) =>
          lecons ? sentence.replace(DAUGHTER_CARNET, DAUGHTER_CARNET + DAUGHTER_LECONS) : sentence)(
          daughterRule(
            dossierResultats,
            brief.role?.consigne ? brief.role : null,
            !!previous,
            !!schemaResultat,
          ),
        ),
    };
  }

  // ---- swarm-15 : the durable lessons (packages/orchestrator/lecons.js). Every call to the module
  // is wrapped (several of its methods throw on a bad scope, id or clock) : a lesson never blocks a
  // start nor an end (rule of swarm) ; a failure means « no lesson », never a mission error.

  // The store and the scope (the mother's pack) of a member of a multi-agent family ; a private
  // mother's lessons live in its space (<cwd>/relay/lecons), never in <dataDir>. Null otherwise.
  leconsDe(run) {
    if (!this.leconsOn) return null;
    const mother = sur(() => this.carnet.motherOf(run));
    const portee = mother?.pack;
    if (typeof portee !== 'string' || !PORTEE_RE.test(portee)) return null;
    if (!mother.workspace) return this.lecons ? { magasin: this.lecons, portee } : null;
    const magasin = this.leconsPrive(mother.cwd);
    return magasin ? { magasin, portee } : null;
  }
  leconsPrive(cwd) {
    if (typeof cwd !== 'string' || !cwd) return null;
    let magasin = this.leconsPrivees.get(cwd);
    if (!magasin) {
      magasin = sur(() => new Lecons({ dir: join(cwd, 'relay', 'lecons'), now: () => this.now() }));
      if (magasin) this.leconsPrivees.set(cwd, magasin);
    }
    return magasin;
  }
  // At start : up to 5 lessons for the request (chief) or the consigne (sub-mission), one line each ;
  // the ids served to this execution are kept. Null when none passes or on any failure.
  servir(run) {
    const ctx = this.leconsDe(run);
    if (!ctx) return null;
    const texte = sur(() => this.engine.turnObjective(run));
    if (typeof texte !== 'string' || !texte.trim()) return null;
    const trouvees = sur(() => ctx.magasin.rappel(texte, ctx.portee));
    if (!Array.isArray(trouvees) || !trouvees.length) return null;
    // rappel() gives the excerpt, not the text : the line of swarm-03 shows it as the summary.
    const lignes = sur(() =>
      trouvees.map((lecon) => ligneLecon({ ...lecon, resume: lecon.extrait }).replace(/^- /, '')),
    );
    if (!lignes) return null;
    const servies = this.servies.get(run.id) ?? {
      ids: new Set(),
      notees: new Set(),
      citees: new Set(),
      cite: false,
      magasin: ctx.magasin,
      portee: ctx.portee,
    };
    for (const lecon of trouvees) servies.ids.add(lecon.id);
    this.servies.set(run.id, servies);
    return lignes;
  }
  // carnet_noter with `durable` (Carnet.note) : the note kept as a lesson too ; the outcome is joined
  // to the note's result (a refusal never refuses the note). Null when the lessons are withdrawn.
  garderLecon(run, mother, { texte, categorie, auteur }) {
    if (!this.leconsOn) return null;
    if (!['methode', 'piege', 'decision'].includes(categorie))
      return { statut: 'refusee', message: LECON_MESSAGES.categorie };
    const ctx = this.leconsDe(run);
    const kept = ctx
      ? sur(() =>
          ctx.magasin.noter({
            texte,
            portee: ctx.portee,
            mission: run.id,
            auteur,
            origine: 'equipe',
          }),
        )
      : null;
    if (typeof kept?.statut !== 'string')
      return { statut: 'refusee', message: LECON_MESSAGES.non_gardee };
    if (kept.statut === 'refusee')
      return { statut: 'refusee', message: String(kept.message ?? LECON_MESSAGES.non_gardee) };
    // The id only (no text) : nothing private reaches the database.
    if (kept.statut === 'gardee')
      sur(() => this.store.event(mother.id, 'lecon_gardee', { id: kept.id }));
    return { statut: kept.statut, id: kept.id };
  }
  // lecon_lire and lecon_utile (their own token checked by call()).
  leconCall(run, control, body) {
    if (!this.leconsOn || !this.lent || !sur(() => this.carnet.motherOf(run)))
      return { status: 403, body: { error: LECON_MESSAGES.non_pretes } };
    const parsed = LECON_TOOLS[body.tool].schema.safeParse(body.args ?? {});
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
    control.toolDelivered?.(null, 'gateway');
    const refus = (erreur) => ({
      status: 200,
      body: { erreur, message: LECON_MESSAGES[erreur] },
    });
    const { id } = parsed.data;
    if (body.tool === 'lecon_lire') {
      const ctx = this.leconsDe(run);
      if (!ctx) return refus('indisponible');
      const lecon = sur(() => ctx.magasin.liste(ctx.portee).find((l) => l.id === id));
      if (!lecon) return refus('inconnue');
      return {
        status: 200,
        body: {
          result: {
            id: lecon.id,
            titre: lecon.titre,
            texte: lecon.texte,
            date: lecon.date,
            utile: lecon.utile ?? 0,
            inutile: lecon.inutile ?? 0,
            nature: LECON_NATURE,
          },
        },
      };
    }
    // lecon_utile : only a lesson served to this execution, once per mission and lesson (swarm) ;
    // `raison` has no place in the module : it is not kept.
    const servies = this.servies.get(run.id);
    if (!servies?.ids.has(id)) return refus('non_servie');
    if (servies.notees.has(id)) return refus('deja_notee');
    const { utile } = parsed.data;
    const noted = sur(() =>
      servies.magasin.noterUtilite(id, servies.portee, { utile, mission: run.id }),
    );
    if (noted?.statut === 'notee' || noted?.statut === 'deja_notee') servies.notees.add(id);
    if (noted?.statut === 'notee')
      return { status: 200, body: { result: { id, utile, statut: 'notee' } } };
    return refus(
      noted?.statut === 'deja_notee'
        ? 'deja_notee'
        : noted?.statut === 'inconnue'
          ? 'inconnue'
          : 'indisponible',
    );
  }
  // At the end : the served ids found in the member's answer are cited (once per execution) ;
  // without an answer, nothing.
  citerLecons(id, answer) {
    const servies = this.servies.get(id);
    if (!servies || servies.cite) return;
    const journal = sur(answer);
    if (typeof journal !== 'string' || !journal) return;
    servies.cite = true;
    for (const note of sur(() => servies.magasin.citer([...servies.ids], journal)) ?? [])
      if (note?.citee) servies.citees.add(note.id);
  }
  // The mother's Bilan line : distinct lessons served to the chief and its sub-missions, cited, and
  // kept by the family (events `lecon_gardee` of this execution).
  leconsBilan(run, children) {
    if (!this.leconsOn) return '';
    const servies = [run, ...children].map((member) => this.servies.get(member.id)).filter(Boolean);
    const ids = new Set(servies.flatMap((s) => [...s.ids]));
    const citees = new Set(servies.flatMap((s) => [...s.citees]));
    const gardees = this.store.events(run.id).filter((e) => e.type === 'lecon_gardee').length;
    return leconsLine({ servies: ids.size, citees: citees.size, gardees });
  }
  // GET /api/lecons and POST /api/lecons/:portee/:id (apps/api/server.js) : a private space's lessons
  // are read and changed in owner mode only. A bad scope, id or action throws (answered 400).
  leconsRoute({ espace, ownerMode, portee, id, action, par } = {}) {
    if (!this.leconsOn)
      return { status: 404, body: { error: 'Leçons désactivées (AGENT_PLATFORM_LECONS=0)' } };
    const prive = espace === 'prive';
    if (prive && !ownerMode)
      return {
        status: 403,
        body: { error: 'Leçons de l’espace privé : mode propriétaire seulement' },
      };
    const magasin = prive ? this.leconsPrive(sur(() => this.engine.career.path())) : this.lecons;
    if (!magasin) return { status: 404, body: { error: 'Leçons indisponibles' } };
    if (id === undefined)
      return {
        status: 200,
        body: { portee, ...(prive ? { espace: 'prive' } : {}), lecons: magasin.liste(portee) },
      };
    const actions = {
      promouvoir: () => magasin.promouvoir(id, portee),
      remplacer: () => magasin.remplacer(id, portee, { par }),
      supprimer: () => magasin.supprimer(id, portee),
    };
    if (!Object.hasOwn(actions, action))
      return { status: 400, body: { error: 'action : promouvoir, remplacer ou supprimer' } };
    const done = actions[action]();
    return { status: done.statut === 'inconnue' ? 404 : 200, body: done };
  }
  // delegation-v2-01 (plan v2, Codex 4) : the chief ends its turn while sub-missions live : the
  // platform waits for their end (the chief's timers paused), then the same session gets ONE more
  // turn with their results joined. Null when there is nothing to give (nothing is read for a
  // mission that launched none) or when the session is closed (the Bilan then says it).
  async synthesis(motherId, control, runtime) {
    if (!control?.mere) return null;
    const mother = this.store.get(motherId);
    const living = this.living(mother);
    // multi-agent-v3-02 (D) : those already ended whose result never reached the chief are joined too.
    const family = this.family(motherId);
    const given = [...living, ...this.undelivered(mother, family)];
    if (!given.length) return this.verdictTurn(mother, family, runtime, control);
    if (runtime.continueSession()) {
      if (living.length) await this.waitLiving(motherId, mother, control, family);
      if (!control.abort.signal.aborted && runtime.continueSession()) {
        // swarm-13 : read after the wait (verifications ended meanwhile count) ; null without debt.
        const attente = this.verdictsJoints(mother, family);
        return {
          familyResults: {
            nature: 'données rapportées par les sous-missions',
            terminees: given.map((child) => this.deliver(family, this.store.get(child.id))),
            ...this.carnet.forChief(mother), // equipe-carnet
            // swarm-12 : the count per task and the owner's request (each absent when unknown).
            ...this.retoursSynthese(mother),
            ...(attente ? { verdictsEnAttente: attente } : {}),
          },
          instructions: attente ? SYNTHESIS_TURN + ' ' + VERDICT_NOTE : SYNTHESIS_TURN,
        };
      }
    }
    this.missed(family, given);
    return null;
  }
  // swarm-13 : the debt of the family : the works whose last verdict is not « approuve »
  // (dettes, taches.js), on the same rows as the Bilan (without the sub-missions refused by the
  // owner), each with its verdict read now. Null on an unexpected error.
  detteOf(mother, family = null) {
    return sur(() => {
      const children = this.childrenOf(mother).filter((child) => child.error !== REFUSED_CHILD);
      return dettes({
        children: children.map((child) => ({ ...child, verdict: this.verdictOf(child) })),
        nonRemises: family ? this.undelivered(mother, family) : 0,
      });
    });
  }
  // swarm-13 : the turn given is said once, durably : `verdict_turn` carries short task ids only.
  // Relecture : MAX_EN_ATTENTE tasks at most go to the chief (the Bilan counts them all) ; the flag
  // is set first, and an event that cannot be written never fails the mission (the turn is given).
  verdictGiven(mother, family, negatifs) {
    family.verdictTurn = true;
    const joints = negatifs.slice(0, MAX_EN_ATTENTE);
    sur(() =>
      this.store.event(mother.id, 'verdict_turn', {
        taches: joints.map((dette) => String(dette.tache).slice(0, 8)),
      }),
    );
    return joints;
  }
  // swarm-13 : the chief ends its turn with nothing else to give but a debt of verdicts : ONE more
  // turn of the same session (the engine gives one family turn per execution at most). Null when the
  // setting is off, the turn was given, there is no debt, the mission is aborted, or the session is
  // closed (continueSession() is called last : it has an effect).
  verdictTurn(mother, family, runtime, control) {
    if (!this.rattrapage || family.verdictTurn) return null;
    if (control?.abort?.signal?.aborted) return null;
    const negatifs = this.detteOf(mother, family)?.verdictsNegatifs;
    if (!negatifs?.length) return null;
    if (!runtime.continueSession()) return null;
    const joints = this.verdictGiven(mother, family, negatifs);
    return {
      familyResults: {
        nature: 'données rapportées par les vérificateurs',
        verdictsEnAttente: joints,
        ...this.carnet.forChief(mother), // equipe-carnet
      },
      instructions: VERDICT_TURN,
    };
  }
  // swarm-13 : the verdicts joined to a synthesis turn that takes place anyway (no second turn) ;
  // null when off, already given or without debt.
  verdictsJoints(mother, family) {
    if (!this.rattrapage || family.verdictTurn) return null;
    const negatifs = this.detteOf(mother)?.verdictsNegatifs;
    if (!negatifs?.length) return null;
    return this.verdictGiven(mother, family, negatifs);
  }
  // multi-agent-v3-02 (K) : the absolute path of the mission's workspace, the chief's working folder,
  // to which `dossierResultats` and `fichiers[].chemin` are relative : the folder where
  // resultsFolder creates them and folderFiles reads them (a sub-mission works in its mother's
  // folder). Only when a sub-mission has a results folder.
  space(mother, children) {
    return children.some((child) => child.famille?.dossierResultats)
      ? { espace: resolve(mother.cwd) }
      : {};
  }
  // multi-agent-v3-02 (D) : the full result of a sub-mission is given to the chief once (wait, follow
  // with details, synthesis turn) ; `family.delivered` keeps those given.
  deliver(family, child) {
    if (family) (family.delivered ??= new Set()).add(child.id);
    return this.outcome(child);
  }
  undelivered(mother, family) {
    return this.childrenOf(mother).filter(
      // One cancelled by the owner's refusal never ran (the Bilan's refusal line says it).
      (child) =>
        terminal.has(child.state) &&
        child.error !== REFUSED_CHILD &&
        !family.delivered?.has(child.id),
    );
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
    // multi-agent-v3-02 (D) : one already ended whose result the chief never received is counted too.
    const unread = this.undelivered(mother, family);
    if (unread.length) this.missed(family, unread);
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
  bilanSection(run, options = {}) {
    // swarm-01 : a multi-agent mission (not a sub-mission) whose final answer carries the line
    // « Décision : seul|équipe » : one line, before the section ; without it, nothing more is read.
    const decision =
      run?.multiAgent === true && !run.famille ? readDecision(options.chiefAnswer) : null;
    const said = decision
      ? '\n' +
        decisionLine(
          decision,
          this.hasFamily(run)
            ? this.childrenOf(this.store.get(run.id) ?? run).filter(
                (child) => child.error !== REFUSED_CHILD,
              ).length
            : 0,
        )
      : '';
    // equipe-carnet : the notebook's line, after the section (nothing while it is empty).
    // equipe-01 (relecture) : the mother's Bilan only, not each sub-mission's.
    return said + this.familyBilan(run, options) + (run?.famille ? '' : this.carnet.bilanLine(run));
  }
  familyBilan(run, { chiefAnswer = '', motherSends = 0 } = {}) {
    if (!this.hasFamily(run)) return '';
    const mother = this.store.get(run.id);
    if (!mother) return '';
    // A sub-mission cancelled by the owner's refusal never ran : the refusal line says it.
    const children = this.childrenOf(mother).filter((child) => child.error !== REFUSED_CHILD);
    const accord = consentLine(mother.delegation);
    if (!children.length) return mother.delegation?.accepted === false ? '\n' + accord : '';
    const missed = [...(this.families.get(run.id)?.unsynthesized ?? [])];
    // swarm-01 : the motives of the delegations, on one line when at least one sub-mission has one.
    const motifs = motifLine(
      children.map((child) => ({
        titre: child.famille?.titre ?? child.title ?? child.id,
        pourquoi: child.famille?.pourquoi,
        motif: child.famille?.motif,
      })),
    );
    const section = familySection({
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
        // multi-agent-v3-01 (D6) : null for a sub-mission that never started.
        durationMs: child.startedAt
          ? (child.finishedAt ? Date.parse(child.finishedAt) : Date.now()) -
            Date.parse(child.startedAt)
          : null,
        bilan: this.bilanOf(child),
        envois: this.sendsOf(child),
        reprend: child.famille?.reprend,
        suiteDe: child.famille?.continue,
        // equipe-01 (E1) : absent without role nor verdict.
        role: child.famille?.role,
        relit: child.famille?.relit,
        verdict: this.verdictOf(child),
        usage: this.doneOf(child).usage, // swarm-14
      })),
      // swarm-14 : le chef (cette exécution) : ce que son agent annonce et son attente.
      chef: {
        agent: mother.agent,
        usage: sur(() => this.engine.active.get(run.id)?.runtime?.usage?.()),
        attente: this.families.get(run.id)?.attente,
      },
    });
    // swarm-13 : the final answer given while a work's last verdict is not « approuve ».
    const malgre = chiefAnswer ? this.verdictBilanLine(mother) : '';
    // swarm-15 : the chief's answer cites its served lessons, then the line (absent when nothing was
    // served nor kept) ; never an error.
    if (chiefAnswer) this.citerLecons(run.id, () => chiefAnswer);
    const lecons = sur(() => this.leconsBilan(run, children)) ?? '';
    return (
      (motifs ? `${section}\n${motifs}` : section) +
      (malgre ? `\n${malgre}` : '') +
      (lecons ? `\n${lecons}` : '')
    );
  }
  // swarm-13 : « tour donné » read from the durable event of this execution, not the memory.
  verdictBilanLine(mother) {
    const negatifs = this.detteOf(mother)?.verdictsNegatifs;
    if (!negatifs?.length) return '';
    const donne = !!sur(() =>
      this.store.events(mother.id).some((event) => event.type === 'verdict_turn'),
    );
    const titres = negatifs.map((dette) => `« ${dette.titre} »`).join(', ');
    return `Réponse finale donnée malgré ${negatifs.length} travail(aux) dont le dernier verdict n’est pas « approuve » (${titres}) ; tour de rattrapage donné au chef : ${donne ? 'oui' : 'non'}.`;
  }
  // A failed or cancelled mother keeps the section in its result too.
  failureSection(run, control) {
    let section = this.bilanSection(run, { motherSends: control?.sendsApproved ?? 0 });
    if (!section) return;
    if (control?.familyStopped) section += '\n' + motherFailedLine(control.familyStopped);
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
    const echec = done?.data?.echec; // swarm-08
    const usage = done?.data?.usage; // swarm-14
    return {
      envois: done?.data?.envois,
      fichiers: Array.isArray(fichiers) ? fichiers : [],
      ...(echec?.classe ? { echec } : {}),
      ...(usage && typeof usage === 'object' && !Array.isArray(usage) ? { usage } : {}),
    };
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
    // multi-agent-v3-01 (D9) : with the files present in its results folder (path and size).
    const folder = this.folderFiles(child);
    const fichiers = [
      ...[...(control?.familyFiles ?? [])].filter(
        (path) => !folder.some((file) => file.chemin === path),
      ),
      ...folder,
    ].slice(0, 200);
    // swarm-08 : the class of the agent's failure and its hour of return (swarm-02), when classed.
    const failure = control?.echecAgent;
    const echec = failure?.classe
      ? { classe: failure.classe, jusqua: failure.jusqua ?? null }
      : null;
    // swarm-14 : ce que l'agent du membre a annoncé de sa consommation (nombres et devise seulement),
    // lu avant que sa fin soit visible : son dernier tour est fini, son runtime est encore là.
    const usage = sur(() => control?.runtime?.usage?.());
    const annonce = usage && typeof usage === 'object' && !Array.isArray(usage) ? usage : null;
    this.finals.set(child.id, {
      envois,
      fichiers,
      ...(echec ? { echec } : {}),
      ...(annonce ? { usage: annonce } : {}),
    });
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
      ...(echec ? { echec } : {}),
      ...(annonce ? { usage: annonce } : {}),
    });
    // swarm-15 : the lessons served to the member and cited in its answer (success or failure).
    this.citerLecons(child.id, () => this.engine.modelAnswerOf(this.store.get(child.id) ?? child));
  }
  // multi-agent-v3-01 (D9) : the files of a sub-mission's results folder (paths relative to the
  // mission folder, sizes), read on disk without following any link ; 200 at most.
  folderFiles(child) {
    const folder = child.famille?.dossierResultats;
    const out = [];
    const walk = (rel, depth) => {
      const entries = readdirSync(join(child.cwd, rel), { withFileTypes: true });
      for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
        if (out.length >= 200) return;
        if (entry.isDirectory() && depth < 8) walk(`${rel}${entry.name}/`, depth + 1);
        else if (entry.isFile())
          out.push({
            chemin: rel + entry.name,
            taille: lstatSync(join(child.cwd, rel, entry.name)).size,
          });
      }
    };
    try {
      if (folder && existsSync(join(child.cwd, folder))) {
        safeDirectory(child.cwd, folder);
        walk(folder, 0);
      }
    } catch {
      /* An unreadable folder lists nothing more. */
    }
    return out;
  }
  // multi-agent-v3-01 (D9) : the results folder of a sub-mission, created by the platform in the
  // mission folder (confined, no link followed) ; null when it cannot be created there.
  resultsFolder(mother, n, titre) {
    const slug =
      titre
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .slice(0, 40)
        .replace(/-+$/, '') || 'sous-mission';
    const folder = `relay/missions/${this.chain(mother).at(-1).id.slice(0, 8)}/${n}-${slug}/`;
    try {
      safeDirectory(mother.cwd, folder);
      return folder;
    } catch {
      return null;
    }
  }
  watch(child, family) {
    let started = false;
    const listener = (event) => {
      if (event.type !== 'state') return;
      const state = event.data?.state;
      // multi-agent-v3-01 (D6) : its duration counts from its first `running`, not its creation.
      if (state === 'running' && !started) {
        started = true;
        this.store.update(child.id, { startedAt: event.at });
      }
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
    let free = parallel - this.occupied(family);
    // multi-agent-v3-01 (D3) : the queue is walked in order ; a sub-mission whose prerequisite still
    // lives keeps its turn without blocking those behind it ; one whose prerequisite did not
    // succeed never starts.
    for (const [id, entry] of [...family.held]) {
      const after = entry.run.famille?.apres;
      if (free <= 0 && !after) continue;
      if (terminal.has(this.store.get(id)?.state)) {
        family.held.delete(id);
        continue;
      }
      const missing = after ? this.prerequisite(entry.run) : null;
      if (missing && terminal.has(missing.state))
        this.cancelHeld(
          id,
          prerequisiteFailed(missing.famille?.titre ?? missing.id, missing.state),
        );
      if (missing || free <= 0) continue;
      free--;
      family.held.delete(id);
      family.launched.add(id);
      this.engine.active.set(id, entry.control);
      setImmediate(() => this.engine.launch(entry.run, entry.plan, entry.control, null));
    }
  }
  // The prerequisite of a sub-mission that keeps it from starting : one that did not succeed first,
  // else one not finished yet ; null when all have succeeded.
  prerequisite(run) {
    const rows = (run.famille?.apres ?? []).map((id) => this.store.get(id)).filter(Boolean);
    return (
      rows.find((row) => terminal.has(row.state) && row.state !== 'completed') ??
      rows.find((row) => row.state !== 'completed') ??
      null
    );
  }
  // The counter given to the chief (mission_lancer, mission_suivre) : multi-agent-v3-01 (D4, D10)
  // tasks and resumed attempts apart, and the sub-missions counted in the envelope.
  counter(mother) {
    const children = this.childrenOf(mother);
    const family = this.families.get(mother.id);
    const { total, parallel } = this.envelope(this.store.get(mother.id));
    const reprises = children.filter(
      (child) => child.famille?.reprend || child.famille?.continue,
    ).length;
    return {
      lancees: children.length,
      taches: children.length - reprises,
      reprises,
      dansEnveloppe: children.filter(counts).length,
      enCours: family ? this.occupied(family) : 0,
      total,
      parallel,
    };
  }
  // A family whose mother and sub-missions have all ended is no longer kept in memory (nor the
  // copies of its sub-missions' records : the database keeps them).
  forget(family) {
    const root = this.store.get(family.rootId);
    if (!root || !terminal.has(root.state) || family.held.size || family.waiters.size) return;
    const children = this.childrenOf(root);
    if (children.some((child) => !terminal.has(child.state))) return;
    if (this.families.get(family.rootId) === family) this.families.delete(family.rootId);
    this.roleSets?.delete(family.rootId);
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
          ...this.teamOf(child),
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
      texte: `${agents} exécution(s) Relay en activité (missions et sous-missions), dont ${waiting} en attente du propriétaire`,
    };
  }

  // ---- the tools (POST /api/internal/missions/<mother>)

  async call(motherId, token, body, signal) {
    const control = this.engine.active.get(motherId);
    if (!control || !token || this.engine.approvalTokens.get(motherId) !== token)
      return { status: 403, body: { error: 'Jeton invalide ou mission inactive' } };
    const mother = this.store.get(motherId);
    // equipe-carnet : the notebook tools, for the chief and for a sub-mission (only these two).
    if (CARNET_TOOLS[body?.tool]) return this.carnet.call(mother, control, body);
    if (RESULT_TOOLS[body?.tool]) return this.resultats.call(mother, control, body); // swarm-10
    if (LECON_TOOLS[body?.tool]) return this.leconCall(mother, control, body); // swarm-15
    // The tools are never lent to a sub-mission, nor to a mission without the multi-agent mode, nor
    // to any mission once withdrawn.
    if (!this.lent || !mother || mother.famille || mother.multiAgent !== true)
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
        mission_continuer: () => continueChild(this, mother, control, parsed.data),
      };
      const result = await handlers[body.tool]();
      // equipe-carnet : the members' notes not given yet reach the chief when it waits or follows.
      // equipe-01 (relecture) : an abandoned call marks nothing given (its answer is thrown away).
      if (['mission_attendre', 'mission_suivre'].includes(body.tool) && !signal?.aborted)
        Object.assign(result, this.carnet.forChief(mother));
      return { status: 200, body: { result } };
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
    // equipe-01 (E1) : the role, and the agents installed for an independent look, read before any
    // counter of the launch is taken (no wait between them and the creation).
    const team = args.role ? this.roleOf(mother, args.role) : null;
    const installed = team?.autreAgent && !args.agent ? await this.agents() : null;
    // equipe-01 (relecture, décision du manager) : the mother may have ended during that wait : the
    // check of call() again (nothing awaited from here to the counters below).
    if (
      installed &&
      (control.abort.signal.aborted ||
        terminal.has(this.store.get(mother.id)?.state) ||
        this.families.get(mother.id)?.closing)
    )
      throw fail('mission_terminee', 'La mission mère se termine ou est annulée');
    const family = this.family(mother.id);
    const root = this.store.get(mother.id);
    // Refused by the owner (card, or the request) : the chief goes on alone ; nothing is asked again.
    if (this.consent(root) === false) throw fail('refus_proprietaire', REFUSED_MESSAGE);
    const { total, parallel } = this.envelope(root);
    const consigne = args.consigne.trim();
    const children = this.childrenOf(mother);
    const launched = children.length + family.pending;
    // multi-agent-v3-01 (D3, D4) : prerequisites and the resumed attempt are sisters ; the first
    // two resumptions of a task (its first attempt) are outside the envelope.
    const sisters = new Map(children.map((child) => [child.id, child]));
    for (const id of [
      ...(args.apres ?? []),
      ...(args.relit ?? []),
      ...(args.reprend ? [args.reprend] : []),
      ...(args.continue ? [args.continue] : []),
    ])
      if (!sisters.has(id))
        throw fail('introuvable', `Aucune sous-mission de cette mission : ${id}`);
    // equipe-01 (E2) : a suite (mission_continuer, `continue`) takes the path of `reprend`.
    const previous = sisters.get(args.reprend ?? args.continue) ?? null;
    if (
      args.reprend &&
      previous &&
      (!terminal.has(previous.state) || previous.state === 'completed')
    )
      throw fail('parametres_invalides', 'reprend — une sous-mission finie sans succès');
    // swarm-10 : the shape of the result, checked now (synchronous, before any folder or counter) ;
    // without one, a resumption or a suite inherits the schema of its task.
    const schemaResultat = this.resultats.schemaForLaunch(args, previous);
    // swarm-05 : the same part is not launched twice (never a resumption nor a suite) : synchronous,
    // before the envelope (no extension card for a doublon) and before any counter below.
    const part = partDe(args, args.agent ?? mother.agent);
    const checked = !previous && this.doublon !== 'off';
    const double = checked ? trouverDoublon(part, this.partsOf(children, family, mother)) : null;
    if (double?.niveau === 'identique' && args.doublon !== true && this.doublon === 'refuse')
      throw fail('doublon', doublonMessage(double));
    // swarm-08 : an agent named by the chief (not the one a suite inherits) and seen unavailable (its
    // limit, its refused session, the limit of the model asked) : refused now, with the reason and
    // the ready agents, nothing created ; malgreIndisponible lets it through. Synchronous.
    const chiefAgent = args.agent !== undefined && args.agentHerite !== true;
    const forced = args.malgreIndisponible === true;
    if (chiefAgent && !forced) {
      const from = previous ?? mother;
      const why = this.unavailable(
        args.agent,
        args.modele ?? (args.agent === from.agent ? (from.model ?? '') : ''),
      );
      if (why)
        throw fail(
          'agent_indisponible',
          agentUnavailable(args.agent, why.raison, this.readyAgents()),
        );
    }
    const taskOf = (child) => {
      const before = (c) => c.famille?.reprend ?? c.famille?.continue;
      for (let n = 0; sisters.has(before(child)) && n < 200; n++)
        child = sisters.get(before(child));
      return child.id;
    };
    // review-multi-agent-v3-01 : resumptions of the task still being created (simultaneous calls)
    // take a rank too ; only the creations in flight that will count are added to the envelope.
    family.resuming ??= new Map();
    family.pendingCounted ??= 0;
    const taskId = previous ? taskOf(previous) : null;
    // multi-agent-v3-02 (F) : one attempt of a task at a time (running, queued, waiting for the
    // owner or a prerequisite, or being created) : the Bilan's last attempt is the last ended.
    if (taskId) {
      const alive = children.find((c) => !terminal.has(c.state) && taskOf(c) === taskId);
      if (alive || family.resuming.get(taskId))
        throw fail(
          'reprise_en_cours',
          `Une tentative de cette tâche est encore en cours${alive ? ` (id ${alive.id})` : ''} : attends sa fin.`,
        );
    }
    const reprise = previous
      ? 1 +
        children.filter((c) => (c.famille?.reprend || c.famille?.continue) && taskOf(c) === taskId)
          .length +
        (family.resuming.get(taskId) ?? 0)
      : 0;
    const free = reprise >= 1 && reprise <= 2;
    const counted = children.filter(counts).length + family.pendingCounted;
    if (!free && counted >= total) {
      // multi-agent-v3-02 (E) : a refusal at this total is kept : no new card.
      if (family.extensionDeclined === total) throw fail('enveloppe_refusee', ENVELOPE_DECLINED);
      if (this.consent(root) !== true)
        throw fail('enveloppe_atteinte', envelopeReachedNoConsent(total));
      this.askExtension(mother, control, counted + 1, total, launched);
      throw fail('enveloppe_atteinte', envelopeReached(total));
    }
    const fichiers = (args.fichiers ?? []).map((path) => path.replaceAll('\\', '/'));
    for (const path of fichiers)
      if (isAbsolute(path) || path.split('/').includes('..'))
        throw fail('fichier_hors_espace', `Chemin hors de l’espace de la mission : ${path}`);
    // A resumption takes the agent, the model and the title of the attempt it resumes by default.
    const base = previous ?? mother;
    // equipe-01 (E1) : a role for an independent look gets an agent other than its authors'.
    const reviewer = installed
      ? otherAgent(
          installed,
          args.relit ? args.relit.map((id) => sisters.get(id).agent) : [mother.agent],
          { live: this.engine.live, probes: loadProbes(this.engine.dataDir) },
        )
      : null;
    const planned = args.agent ?? reviewer ?? base.agent;
    // swarm-16 : the model : `modele` given ; then `niveau` ; then, for a resumption or a suite on the
    // same agent, the previous attempt's ; then the role's tier ; then today's rule. A tier chooses
    // among the models the agent announces (patterns of its profile) ; none matching : today's rule.
    const probes = this.probes();
    const choose = (id, given) =>
      choisirModele({
        ...given,
        niveau: args.niveau,
        niveauRole: team?.niveau,
        profil: getProfile(id),
        modelesAnnonces: optionsOf(probes[id]),
      });
    const planChoice = choose(planned, {
      modele: args.modele,
      precedent: previous && planned === previous.agent ? (previous.model ?? '') : undefined,
      defaut: planned === base.agent ? (base.model ?? '') : '',
    });
    const plannedModel = planChoice.modele;
    // swarm-08 : the agent the platform chose (none named by the chief) is unavailable : the first
    // ready agent instead (never the simulated one in real mode, a proven session first), said in the
    // result and on the row ; none : the same refusal. Synchronous, before any folder or counter.
    const why = chiefAgent || forced ? null : this.unavailable(planned, plannedModel);
    const instead = why
      ? otherAgent(this.agentsNow(), [planned], {
          live: !!this.engine.live,
          probes: this.probes(),
        })
      : null;
    if (why && !instead)
      throw fail('agent_indisponible', agentUnavailable(planned, why.raison, this.readyAgents()));
    const agent = instead ?? planned;
    // swarm-16 : another agent takes the part : a model given is left (as before), a tier (asked, or
    // the role's) is resolved at that agent. The tier is written when it chose the model ; one that
    // does not resolve is said in the note (the role's only for an agent with tiers announcing models).
    const choice = instead ? choose(instead, { defaut: '' }) : planChoice;
    const modele = choice.modele;
    const niveau = ['niveau', 'role'].includes(choice.source) ? choice.niveau : null;
    const niveauNote =
      choice.nonReconnu &&
      (choice.depuis === 'niveau' ||
        (getProfile(agent)?.niveaux && optionsOf(probes[agent]).length))
        ? niveauNonReconnu(choice.nonReconnu)
        : null;
    const named = args.continue
      ? suiteTitle(
          sisters.get(taskId).famille?.titre ?? taskId,
          1 + children.filter((c) => c.famille?.continue && taskOf(c) === taskId).length,
        )
      : (args.titre ?? previous?.famille?.titre);
    const asked = (named ?? consigne).replace(/\s+/g, ' ').trim();
    const privateTitle = !!mother.workspace && !this.engine.ownerMode;
    const titre = privateTitle
      ? `Sous-mission ${launched + 1}`
      : named
        ? asked.slice(0, 80)
        : asked.slice(0, 60);
    const folder = args.continue
      ? (previous.famille?.dossierResultats ?? null)
      : this.resultsFolder(mother, launched + 1, titre);
    const tache = Object.fromEntries(
      TASK_FIELDS.filter((key) => args[key]).map((key) => [key, args[key]]),
    );
    const link = {
      link: {
        racine: mother.id,
        mere: mother.id,
        titre,
        ...(args.apres || args.relit
          ? { apres: [...new Set([...(args.apres ?? []), ...(args.relit ?? [])])] }
          : {}),
        ...(args.relit ? { relit: [...new Set(args.relit)] } : {}),
        // equipe-01 (relecture) : a private mission writes no role name of its own in the database
        // (as its title) : only a platform role's name ; the role itself stays in memory (briefs).
        // equipe-01 (E5) : or the name of a role of its pack (a fixed name of the repository).
        ...(team &&
        (!privateTitle || loadRoles(null, { pack: mother.pack }).roles.has(roleKey(team.nom)))
          ? { role: team.nom }
          : {}),
        ...(team?.verdict ? { verdictAttendu: true } : {}),
        ...(previous ? { [args.continue ? 'continue' : 'reprend']: previous.id, reprise } : {}),
        ...(folder ? { dossierResultats: folder } : {}),
        // swarm-01 : the motive ; its note is not written for a private mission (as its title).
        ...(args.pourquoi ? { pourquoi: args.pourquoi } : {}),
        ...(args.note && !privateTitle ? { motif: args.note } : {}),
        // swarm-08 : the agent planned when another was launched ; the agent named by the chief.
        ...(instead ? { agentPrevu: planned } : {}),
        ...(chiefAgent ? { agentImpose: true } : {}),
        ...(niveau ? { niveau } : {}), // swarm-16 : the tier that chose the model.
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
    if (checked) this.creating(family, part, titre, 1); // swarm-05
    if (taskId) family.resuming.set(taskId, (family.resuming.get(taskId) ?? 0) + 1);
    if (!free) family.pendingCounted++;
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
      // The empty results folder of a sub-mission never created is removed.
      try {
        if (folder && !args.continue) rmdirSync(join(mother.cwd, folder));
      } catch {
        /* Not empty, or already gone. */
      }
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
      if (checked) this.creating(family, part, titre, -1); // swarm-05
      if (taskId) {
        const left = family.resuming.get(taskId) - 1;
        if (left > 0) family.resuming.set(taskId, left);
        else family.resuming.delete(taskId);
      }
      if (!free) family.pendingCounted--;
      this.wake(family);
    }
    // review-multi-agent-v3-01 : the mother failed (stopFamily, no abort) while it was created.
    if (control.abort.signal.aborted || family.stopped) {
      // The mother ended while the sub-mission was planned : it never starts.
      if (family.stopped) control.familyStopped = (control.familyStopped ?? 0) + 1;
      this.store.update(run.id, {
        state: 'cancelled',
        error: family.stopped ? MOTHER_FAILED : 'Mission mère terminée avant le départ',
        finishedAt: new Date().toISOString(),
      });
      this.wake(family);
      throw fail('mission_terminee', 'La mission mère se termine ou est annulée');
    }
    const soeurs = this.childrenOf(mother)
      .filter((child) => child.id !== run.id)
      .map((child) => child.famille?.titre ?? child.id);
    this.briefs.set(run.id, {
      fichiers,
      soeurs,
      // swarm-05 : the part as compared (memory only : gone after a restart).
      part,
      ...(Object.keys(tache).length ? { tache } : {}),
      ...(schemaResultat ? { schemaResultat } : {}), // swarm-10
      ...(team
        ? {
            role: team.consigne
              ? {
                  nom: team.nom,
                  description: team.description,
                  consigne: team.consigne,
                  verdict: team.verdict,
                }
              : { nom: team.nom },
          }
        : {}),
    });
    // swarm-10 : the schema in the results folder too (read again after a restart).
    if (schemaResultat) this.resultats.writeSchema(mother.cwd, folder, schemaResultat);
    this.observe(link.held.control, run.cwd);
    family.held.set(run.id, link.held);
    const child = this.store.get(run.id);
    this.watch(child, family);
    this.store.event(mother.id, 'child_launched', {
      childId: run.id,
      titre,
      agent,
      modele,
      ...(args.pourquoi ? { pourquoi: args.pourquoi } : {}),
    });
    const consent = this.consent(this.store.get(mother.id));
    // Refused while this one was being created : it never starts.
    if (consent === false) {
      this.cancelHeld(run.id, REFUSED_CHILD);
      throw fail('refus_proprietaire', REFUSED_MESSAGE);
    }
    // swarm-05 : a near part (or an identical one let through) is said on the mother's
    // thread, once past the owner's refusal during its creation.
    const doublonProbable = double && {
      id: double.id ?? null,
      titre: double.titre,
      similarite: Math.round(double.similarite * 100) / 100,
    };
    if (double)
      this.store.event(mother.id, 'doublon_signale', {
        childId: run.id,
        proche: doublonProbable.id,
        similarite: doublonProbable.similarite,
        niveau: double.niveau,
      });
    // No acceptance yet : the sub-mission waits, the owner gets the card (once).
    if (consent !== true) this.askConsent(mother, control);
    this.pump(family);
    // A prerequisite already ended without success : it was cancelled at once.
    const ended = this.store.get(run.id)?.state;
    const etat = this.heldState(run.id) ?? (terminal.has(ended) ? ended : 'en_cours');
    return {
      id: run.id,
      titre,
      etat,
      agent,
      modele,
      ...(niveau ? { niveau } : {}), // swarm-16
      ...(folder ? { dossierResultats: folder, espace: resolve(mother.cwd) } : {}),
      famille: this.counter(mother),
      ...(doublonProbable ? { doublonProbable } : {}),
      ...note([
        etat === 'attend_accord' && CONSENT_PENDING_NOTE,
        installed && !reviewer && SAME_AGENT_NOTE,
        doublonProbable && doublonNote(doublonProbable, double.niveau),
        instead && agentReplaced(planned, why.raison, instead),
        niveauNote, // swarm-16
      ]),
    };
  }
  // swarm-05 : the parts a new launch is compared with : the sisters (their part kept in memory at
  // their launch ; after a restart, their consigne only, so never `identique`, and nothing for a
  // private mission, whose consigne in the database is generic), plus the identical parts being
  // created by simultaneous calls (family.creating, no id yet).
  partsOf(children, family, mother) {
    const prive = !!mother.workspace && !this.engine.ownerMode;
    const parts = [];
    for (const child of children) {
      const kept = this.briefs.get(child.id)?.part;
      if (!kept && prive) continue;
      parts.push({
        id: child.id,
        titre: child.famille?.titre ?? child.id,
        agent: child.agent ?? null,
        role: kept ? kept.role : (child.famille?.role ?? null),
        etat: this.heldState(child.id) ?? child.state,
        texte: kept ? kept.texte : (this.engine.turnObjective?.(child) ?? ''),
        ...(kept ? { empreinte: kept.empreinte } : {}),
      });
    }
    for (const { titre, agent, empreinte } of family.creating?.values() ?? [])
      parts.push({
        id: null,
        titre,
        agent,
        role: null,
        etat: 'creation',
        texte: '',
        empreinte,
      });
    return parts;
  }
  // swarm-05 : one more (or one less) identical part being created, for the same agent (relecture,
  // décision du manager : the same part to another agent is not refused) ; the entry goes at zero.
  creating(family, { empreinte, agent }, titre, step) {
    family.creating ??= new Map();
    const key = JSON.stringify([empreinte, agent]);
    const entry = family.creating.get(key);
    const n = (entry?.n ?? 0) + step;
    if (n > 0) family.creating.set(key, { n, titre: entry?.titre ?? titre, agent, empreinte });
    else family.creating.delete(key);
  }
  // swarm-05 : famille.membres, the other members as they are at the start of a sub-mission : living
  // or successful, 20 at most, their part cut at 200 characters (none for a private mission).
  // swarm-08 : never an error (the start of a sub-mission depends on it) : none then.
  membersOf(run, mother) {
    try {
      return this.membersRows(run, mother);
    } catch {
      return [];
    }
  }
  membersRows(run, mother) {
    const prive = !!mother.workspace && !this.engine.ownerMode;
    const rows = this.childrenOf(mother)
      .filter((child) => child.id !== run.id)
      .map((child) => {
        const kept = this.briefs.get(child.id)?.part;
        return {
          id: child.id,
          titre: child.famille?.titre ?? child.id,
          ...(child.famille?.role ? { role: child.famille.role } : {}),
          agent: child.agent ?? null,
          etat: this.heldState(child.id) ?? child.state,
          ...(prive
            ? {}
            : { texte: kept ? kept.texte : (this.engine.turnObjective?.(child) ?? '') }),
          creeLe: child.createdAt,
          dernierSigneLe: this.store.events?.(child.id)?.at(-1)?.at,
        };
      });
    return membres(rows, { now: Date.now(), prive });
  }
  // equipe-01 (E1) : the roles of a mission (platform's, then its pack's (E5), then its
  // workspace's) ; a file not read as a role is said once on the mother (`role_ignore`).
  // equipe-01 (relecture, décision du manager) : read once per family (this execution of the
  // mother), at their first use, then kept : a file written later under relay/roles has no effect
  // during this mission. A resumption (a new run) or a restart reads them again.
  roles(mother) {
    this.roleSets ??= new Map();
    const kept = this.roleSets.get(mother.id);
    if (kept) return kept;
    const { roles, ignored } = loadRoles(mother.cwd, { pack: mother.pack });
    this.roleSets.set(mother.id, roles);
    for (const file of ignored) this.store.event(mother.id, 'role_ignore', file);
    return roles;
  }
  // A defined role, or a free name (a mere label).
  roleOf(mother, name) {
    return this.roles(mother).get(roleKey(name)) ?? { nom: name.trim() };
  }
  // The verdict of a verification sub-mission once ended (data reported by it), else null.
  // equipe-01 (relecture) : none for one that never started ; its own verdict.json only.
  verdictOf(child) {
    if (!child?.famille?.verdictAttendu || !terminal.has(child.state) || !child.startedAt)
      return null;
    return readVerdict({
      cwd: child.cwd,
      folder: child.famille.dossierResultats,
      answer: this.engine.modelAnswerOf(child),
      since: child.startedAt,
      until: child.finishedAt,
    });
  }
  // Role, reviewed sub-missions and verdict of a row, each absent when it has none.
  teamOf(child) {
    const verdict = this.verdictOf(child);
    return {
      ...(child.famille?.role ? { role: child.famille.role } : {}),
      ...(child.famille?.relit ? { relit: child.famille.relit } : {}),
      ...(verdict ? { verdict } : {}),
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
  askExtension(mother, control, nth, total, lancees) {
    const family = this.family(mother.id);
    if (family.asking) return;
    family.asking = true;
    this.store.event(mother.id, 'delegation_envelope_reached', { total, asked: nth, lancees });
    const question = choiceQuestion(extensionMessage(nth, total, lancees), EXTENSION_CHOICES);
    Promise.resolve(this.engine.enqueueQuestion(mother.id, question, control)).then((reply) => {
      family.asking = false;
      // multi-agent-v3-02 (E) : « Non » (or the card declined) is kept for this total ; a mission
      // that ends meanwhile, or a question expired, decides nothing.
      if (
        reply?.action === 'decline' ||
        (reply?.action === 'accept' && reply.content?.choix === 'non')
      ) {
        family.extensionDeclined = total;
        this.store.event(mother.id, 'delegation_extension_declined', { total });
        return;
      }
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
    if (this.consent(this.store.get(family.rootId)) !== true) return 'attend_accord';
    return this.prerequisite(family.held.get(id).run) ? 'attend_prerequis' : 'en_file';
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
        ? ({ en_file: 'place', attend_prerequis: 'prerequis' }[held] ?? 'accord')
        : child.state === 'awaiting_owner'
          ? 'question'
          : this.engine.pendingPermission(child.id)
            ? 'carte_envoi'
            : null,
      outils: this.store.usage(child.id).entries.filter((e) => e.dimension === 'tool_observed')
        .length,
      dernierOutil: lastTool ? readToolCall(lastTool.data).tool.slice(0, 80) || null : null,
      ...(child.famille?.role ? { role: child.famille.role } : {}),
      ...(child.famille?.relit ? { relit: child.famille.relit } : {}),
      // swarm-01 : the motive, when the chief gave one.
      ...(child.famille?.pourquoi ? { pourquoi: child.famille.pourquoi } : {}),
      ...(child.famille?.motif ? { motif: child.famille.motif } : {}),
      // swarm-12 : the last report of the loop guard (swarm-06), only when there is one.
      ...(sur(() => {
        const dernier = this.engine.active.get(child.id)?.loop?.dernier;
        return dernier ? { boucle: dernier } : null;
      }) ?? {}),
    };
  }
  // swarm-08 : { classe, jusqua?, agentsPrets } of a classed failure of the agent, else {}.
  failureOf(child) {
    const echec = this.doneOf(child).echec;
    if (!echec?.classe) return {};
    return {
      classe: echec.classe,
      ...(echec.jusqua ? { jusqua: echec.jusqua } : {}),
      agentsPrets: this.readyAgents(),
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
            // swarm-08 : the class of a classed failure, its hour of return, the agents ready now.
            ...this.failureOf(child),
          };
    // swarm-10 : the result given by resultat_rendre, already parsed (absent when nothing to say).
    const resultat = this.resultats.of(child);
    return {
      id: child.id,
      titre: child.famille?.titre ?? child.title,
      etat: child.state,
      reponse: this.engine.modelAnswerOf(child).slice(0, MAX_ANSWER_CHARS),
      bilan: this.bilanOf(child),
      fichiers: this.doneOf(child).fichiers,
      envois: this.sendsGiven(child),
      cause,
      ...(this.verdictOf(child) ? { verdict: this.verdictOf(child) } : {}),
      ...(resultat ? { resultat } : {}),
      ...this.retoursFin(child), // swarm-12
    };
  }
  // swarm-12 : what a finished sub-mission's result gains (each field absent when empty) : the
  // sisters cancelled because it was their prerequisite (not for a completed one), and the chief's
  // messages that never reached it.
  retoursFin(child) {
    const dependantes =
      child.state === 'completed'
        ? null
        : sur(() => {
            const soeurs = this.soeursDe(child.famille?.mere);
            return soeurs ? dependantesAnnulees(child, soeurs) : null;
          });
    const messages = sur(() =>
      messagesDuChef(this.store.events(child.id)).map((m) => ({ ...m, note: MESSAGE_NON_REMIS })),
    );
    return {
      ...(dependantes?.length ? { dependantesAnnulees: dependantes } : {}),
      ...(messages?.length ? { messagesDuChef: messages } : {}),
    };
  }
  // swarm-12 (relecture) : the sisters of a mother, read once per synchronous pass (a wait or a
  // synthesis turn giving N results reads them once, not N times) and forgotten at the next
  // microtask, so a later call reads them afresh. Null for an unknown mother.
  soeursDe(motherId) {
    if (this.soeursLues?.id !== motherId) {
      const mother = this.store.get(motherId);
      const rows = mother ? this.childrenOf(mother) : null;
      if (!this.soeursLues) queueMicrotask(() => (this.soeursLues = null));
      this.soeursLues = { id: motherId, rows };
    }
    return this.soeursLues.rows;
  }
  // swarm-12 : the count per task of the whole family, on the same rows as the Bilan's « Par
  // tâche (dernière tentative) » line (without the sub-missions refused by the owner, a held one
  // `queued`). Null on an unexpected error.
  agregatOf(mother) {
    return sur(() =>
      agregat(
        this.childrenOf(mother)
          .filter((child) => child.error !== REFUSED_CHILD)
          .map((child) => (this.held(child.id) ? { ...child, state: 'queued' } : child)),
      ),
    );
  }
  // swarm-12 : the owner's request cut to 300 characters. Prudent rule (relecture) : given only for
  // a mission WITHOUT a private workspace whose pack is the general one by default (`packs[0]`, the
  // fallback of getPack) ; any other mission (a workspace, another pack, an unknown pack, owner mode
  // included) gets none. No pack is named here.
  demandeOf(mother) {
    return sur(() => {
      const prive = !!mother.workspace || !mother.pack || mother.pack !== packs[0]?.id;
      return demandeCourte(prive ? null : this.engine.turnObjective(mother), { prive });
    });
  }
  // swarm-12 : what mission_attendre gains : `agregat` when `toutes` and nothing runs any more in
  // the whole family ; `rappel { demande, enCours }` (enCours : the number of living
  // sub-missions), absent when there is nothing to say.
  retoursAttente(mother, toutes) {
    const calme =
      !!toutes &&
      sur(() =>
        this.childrenOf(mother).every((child) => terminal.has(child.state) && !this.held(child.id)),
      );
    const agregatFamille = calme ? this.agregatOf(mother) : null;
    const demande = this.demandeOf(mother);
    const vivantes = sur(() => this.living(mother).length) ?? 0;
    return {
      ...(agregatFamille ? { agregat: agregatFamille } : {}),
      ...(demande || vivantes
        ? { rappel: { ...(demande ? { demande } : {}), enCours: vivantes } }
        : {}),
    };
  }
  // swarm-12 : what the synthesis turn's familyResults gains.
  retoursSynthese(mother) {
    const agregatFamille = this.agregatOf(mother);
    const demande = this.demandeOf(mother);
    return {
      ...(agregatFamille ? { agregat: agregatFamille } : {}),
      ...(demande ? { demande } : {}),
    };
  }
  // The agents installed, with the models each announced at its last session on this machine :
  // the same record as the « Modèle non annoncé » check of a mission (orchestrator plan()).
  async agents() {
    if (!this.agentsCache || Date.now() - this.agentsCache.at >= AGENTS_CACHE_MS)
      this.agentsCache = {
        at: Date.now(),
        // swarm-08 : the raw detection is kept ; the state is computed at each call (a limit ends
        // at its hour, a refused session ages) by agentsNow().
        list: (await detectAgents()).map((agent) => ({
          id: agent.id,
          installed: !!agent.installed,
          compatible: !!agent.compatible,
          simulated: !!agent.simulated,
          ...(agent.reason ? { reason: agent.reason } : {}),
        })),
      };
    return this.agentsNow();
  }
  // swarm-08 : the agents of the cache with their real state (synchronous : the cache and the probes
  // file only) ; [] while nothing was detected. equipe-01 (essai réel du 20/11) : the simulated agent
  // is said so, and is not available for a real work in real mode.
  agentsNow() {
    const probes = this.probes();
    const now = this.now();
    const list = this.detected().map((agent) => {
      const { etat, raison, jusqua, modelesLimites } = agentState(agent, probes[agent.id], {
        now,
        live: !!this.engine.live,
      });
      return {
        id: agent.id,
        disponible: Object.hasOwn(USABLE, etat),
        etat,
        ...(raison ? { raison } : {}),
        ...(jusqua ? { jusqua } : {}),
        ...(agent.simulated ? { simule: true } : {}),
        // swarm-16 : with the tier of each model, when its profile knows it (avecNiveaux).
        modeles: avecNiveaux(
          optionsOf(probes[agent.id]).map((model) => ({
            id: model.id,
            nom: model.name ?? model.id,
            ...(modelesLimites?.[model.id] ? { limiteJusqua: modelesLimites[model.id] } : {}),
          })),
          getProfile(agent.id),
        ),
        modeleParDefaut: probes[agent.id]?.models?.current ?? null,
      };
    });
    return list
      .map((agent, index) => ({ agent, index }))
      .sort((x, y) => rank(x.agent) - rank(y.agent) || x.index - y.index)
      .map(({ agent }) => agent);
  }
  // swarm-08 (relecture) : the detected agents of the cache, its well-formed entries only.
  detected() {
    const list = this.agentsCache?.list;
    return Array.isArray(list)
      ? list.filter((agent) => agent && typeof agent === 'object' && typeof agent.id === 'string')
      : [];
  }
  // swarm-08 : the probes file, never an error (a missing data folder reads as no probe).
  probes() {
    try {
      const probes =
        typeof this.engine.dataDir === 'string' && this.engine.dataDir
          ? loadProbes(this.engine.dataDir)
          : null;
      return probes && typeof probes === 'object' && !Array.isArray(probes) ? probes : {};
    } catch {
      return {};
    }
  }
  // swarm-08 : why an agent (and the model asked) cannot work now, or null : its limit, its session
  // refused less than 10 minutes ago, or the limit of that model. Seen in the cache when the agent was
  // detected ; otherwise (nothing detected yet, or an agent the cache does not know) on its probes
  // only : an agent without a probe is ready. Synchronous. swarm-08 (relecture) : an unexpected
  // error lets the launch through (null).
  unavailable(agentId, modele) {
    try {
      const known = this.detected().find((agent) => agent.id === agentId);
      const state = agentState(
        known ?? { id: agentId, installed: true, compatible: true },
        this.probes()[agentId],
        { now: this.now(), live: known ? !!this.engine.live : true },
      );
      if (state.etat === 'limite' || state.etat === 'connexion_refusee')
        return { raison: state.raison };
      const limit = modele ? state.modelesLimites?.[modele] : null;
      return limit ? { raison: modelLimitReason(limitReason(limit), modele) } : null;
    } catch {
      return null;
    }
  }
  // swarm-08 : the ready agents of the cache (ids), the order of mission_suivre.
  readyAgents() {
    return this.agentsNow()
      .filter((agent) => agent.disponible)
      .map((agent) => agent.id);
  }
  async follow(mother, { id, details }) {
    const children = this.childrenOf(mother);
    const list = id ? children.filter((child) => child.id === id) : children;
    if (id && !list.length)
      throw fail('introuvable', 'Aucune sous-mission de cette mission avec cet id');
    return {
      missions: list.map((child) =>
        details && terminal.has(child.state)
          ? { ...this.line(child), ...this.deliver(this.families.get(mother.id), child) }
          : this.line(child),
      ),
      agents: await this.agents(),
      activite: this.activity(),
      famille: this.counter(mother),
      roles: roleList(this.roles(mother)),
      ...this.space(mother, children),
      nature: 'données rapportées par les sous-missions',
    };
  }
  async wait(mother, control, { ids, toutes, delaiSecondes }, signal) {
    const children = this.childrenOf(mother);
    const known = new Set(children.map((child) => child.id));
    for (const id of ids ?? [])
      if (!known.has(id)) throw fail('introuvable', `Aucune sous-mission de cette mission : ${id}`);
    const targets = ids ?? [...known];
    // swarm-14 : compteur des appels du chef et du temps passé à attendre (horloge `this.now`).
    const attente = (this.family(mother.id).attente ??= { appels: 0, ms: 0 });
    attente.appels += 1;
    const over = (id) => terminal.has(this.store.get(id)?.state) && !this.held(id);
    // Every call gives the state of all the sub-missions asked for (plan v2, Codex 2), the full
    // result of one only once (multi-agent-v3-02, D, below). Without `toutes`,
    // the call returns as soon as one of those still running when it started has ended. With
    // `toutes` (multi-agent-v3-02), also as soon as one of those ends without success, so the chief
    // can take it up again at once ; one already ended at the start of the call does not count,
    // and a sub-mission held behind a prerequisite that has just failed is cancelled first (pump).
    const running = targets.filter((id) => !over(id));
    const unsuccessful = (id) => over(id) && this.store.get(id)?.state !== 'completed';
    const doomed = (id) => {
      const missing = this.held(id) && this.prerequisite(this.store.get(id) ?? {});
      return !!missing && terminal.has(missing.state);
    };
    const done = () =>
      toutes
        ? running.every(over) || (running.some(unsuccessful) && !running.some(doomed))
        : running.some(over);
    let reached = false;
    if (running.length && !done()) {
      const family = this.family(mother.id);
      control.suspendTimers?.();
      control.runtime?.pauseDeadlines?.();
      family.waiting = (family.waiting ?? 0) + 1;
      const debut = sur(() => this.now()); // swarm-14 : une horloge qui lève ne change rien
      try {
        reached = !(await this.untilOr(
          family,
          done,
          waitSeconds(delaiSecondes) * 1000,
          signal,
          control.abort.signal,
        ));
      } finally {
        sur(() => {
          if (typeof debut === 'number') attente.ms += Math.max(0, Number(this.now() - debut) || 0);
        });
        family.waiting--;
        control.runtime?.resumeDeadlines?.();
        control.resumeTimers?.();
      }
    }
    if (control.abort.signal.aborted) throw fail('mission_terminee', 'La mission mère est arrêtée');
    return {
      // multi-agent-v3-02 (D) : the full result once ; afterwards a short line (mission_suivre with
      // details reads it again). A call given up on the way (its answer never reached the chief)
      // marks nothing : the next call gives the full result.
      terminees: targets.filter(over).map((id) => {
        const child = this.store.get(id);
        const family = this.family(mother.id);
        if (!family.delivered?.has(id)) return this.deliver(signal?.aborted ? null : family, child);
        const { titre, etat } = this.line(child);
        return { id, titre, etat, dejaRemise: true };
      }),
      enCours: targets
        .filter((id) => !over(id))
        .map((id) => {
          const { titre, etat, attend } = this.line(this.store.get(id));
          return { id, titre, etat, attend };
        }),
      delaiAtteint: reached,
      ...this.space(mother, children),
      nature: 'données rapportées par les sous-missions',
      ...this.retoursAttente(mother, toutes), // swarm-12
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

  // multi-agent-v3-01 (D2) : a mother that fails stops its sub-missions (nothing launches any
  // more), then waits up to 10 s for their end, before its Bilan. Never for any other mission.
  async stopFamily(run, control) {
    if (!control?.mere) return;
    const family = this.family(run.id);
    family.closing = true;
    family.stopped = true;
    control.familyStopped = this.cascade(run.id, MOTHER_FAILED);
    const mother = this.store.get(run.id);
    // multi-agent-v3-02 (G) : the sub-missions being created too (family.pending), so that the
    // Bilan names them ; launch wakes this wait once a creation has ended.
    await this.until(
      family,
      () => !family.pending && !this.living(mother).length,
      AbortSignal.timeout(10000),
    );
  }
  // multi-agent-v3-02 (H) : a mother cancelled by the owner : its sub-missions, already cancelled by
  // cancel()'s cascade, end before its Bilan (at most 10 s) ; no new cascade. Nothing for a mission
  // that launched none.
  async waitStopped(run, control) {
    if (!control?.mere) return;
    const family = this.family(run.id);
    const mother = this.store.get(run.id);
    await this.until(
      family,
      () => !family.pending && !this.living(mother).length,
      AbortSignal.timeout(10000),
    );
  }
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
