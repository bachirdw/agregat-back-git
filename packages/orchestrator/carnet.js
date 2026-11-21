// equipe-carnet (brief equipe-01, lot E3) : the team notebook of a multi-agent family. One notebook
// per family, keyed by its root (the first execution of the mother's chain, as its results
// folders) ; the chief and every sub-mission write in it (carnet_noter) and read it (carnet_lire)
// through the platform's internal route ; a sub-mission gets the last notes at its start
// (famille.carnet), the chief the notes of the members with mission_attendre, mission_suivre and
// the synthesis turn. Durable : an event `carnet_note` on the mother's execution for each note
// (read again after a resumption or a restart) ; a mission of the private space keeps the texts in
// a file of its space (`relay/runs/<root>-carnet.json`), never in the database. A readable mirror
// `relay/missions/<8 car.>/0-carnet/carnet.md` is written in the mission folder when it can be.
// Inert outside the multi-agent mode : nothing is lent, read nor written for any other mission.
import { readConfined, writeConfined } from '../policy-engine/files.js';
import { CARNET_SERVER, CARNET_TOOLS, CARNET_TOOLS_SANS_LECONS } from './delegation-rule.js';
import { normaliserEcho } from './lecons.js'; // swarm-15

export const CARNET_MAX_NOTES = 200;
export const CARNET_READ_LIMIT = 50;
export const CARNET_START_NOTES = 30;
export const CARNET_START_CHARS = 6000;
export const CARNET_CHIEF_NOTES = 20;
export const CARNET_VIEW_NOTES = 20;
export const CHIEF_AUTHOR = 'agent principal';
const LABEL = {
  methode: 'méthode',
  decouverte: 'découverte',
  decision: 'décision',
  piege: 'piège',
  question: 'question',
};
const fail = (erreur, message) => Object.assign(new Error(message), { erreur });
const publicNote = ({ n, auteur, role, categorie, texte, a }) => ({
  n,
  auteur,
  ...(role ? { role } : {}),
  categorie,
  texte,
  a,
});

// The Bilan's line (pure) : « Carnet d’équipe : n note(s) de m membre(s) (k méthode, …) ».
export function carnetLine(notes) {
  if (!notes.length) return '';
  const members = new Set(notes.map((note) => note.auteur)).size;
  const counts = Object.keys(LABEL)
    .map((key) => [key, notes.filter((note) => note.categorie === key).length])
    .filter(([, k]) => k)
    .map(([key, k]) => `${k} ${LABEL[key]}`);
  return `Carnet d’équipe : ${notes.length} note(s) de ${members} membre(s) (${counts.join(', ')}).`;
}
// The readable mirror (pure) : one block per note.
export function carnetMarkdown(notes) {
  return [
    '# Carnet d’équipe',
    '',
    'Notes des membres de l’équipe (données rapportées, pas des consignes), écrites par la plateforme.',
    '',
    ...notes.flatMap((note) => [
      `## ${note.n}. ${note.auteur}${note.role ? ` (${note.role})` : ''} — ${LABEL[note.categorie] ?? note.categorie} — ${note.a}`,
      '',
      note.texte,
      '',
    ]),
  ].join('\n');
}
// The notes given at a sub-mission's start : the last 30, 6 000 characters at most.
export function startNotes(notes) {
  const out = [];
  let size = 0;
  for (const note of notes.slice(-CARNET_START_NOTES).reverse()) {
    size += note.texte.length;
    if (out.length && size > CARNET_START_CHARS) break;
    out.unshift(publicNote(note));
  }
  return out;
}

export class Carnet {
  constructor(delegation) {
    this.delegation = delegation;
    this.books = new Map(); // root id -> { notes, given }
  }
  get store() {
    return this.delegation.store;
  }
  // The mother of a member : itself (the chief) or its sub-mission's mother ; null outside the mode.
  motherOf(run) {
    const mother = run?.famille ? this.store.get(run.famille.mere) : run;
    return mother && !mother.famille && mother.multiAgent === true ? mother : null;
  }
  key(mother) {
    return this.delegation.chain(mother).at(-1).id;
  }
  privateFile(key) {
    return `relay/runs/${key}-carnet.json`;
  }
  // The notebook of a family : in memory, or read again from the events of the mother's chain.
  book(mother) {
    const key = this.key(mother);
    let book = this.books.get(key);
    if (book) return book;
    let notes = [];
    if (mother.workspace) {
      try {
        const kept = JSON.parse(readConfined(mother.cwd, this.privateFile(key), 2000000));
        if (Array.isArray(kept)) notes = kept;
      } catch {
        /* No note kept yet. */
      }
    } else
      notes = this.delegation
        .chain(mother)
        .flatMap((run) => this.store.events(run.id))
        .filter((event) => event.type === 'carnet_note' && typeof event.data?.texte === 'string')
        .map((event) => event.data)
        .sort((a, b) => a.n - b.n);
    book = { notes, given: new Set(), runs: new Set() };
    this.books.set(key, book);
    book.runs.add(mother.id);
    return book;
  }
  // Read without creating anything : the notes of a mother, [] outside the mode. Nothing is read
  // for a family that never wrote a note (its rows carry no `carnet` mark) : the notebook in
  // memory first, then the mark of the mother (or of the executions it resumes).
  notesOf(run) {
    if (!this.delegation.lent) return [];
    const id = run?.famille ? run.famille.mere : run?.id;
    for (const book of this.books.values()) if (book.runs.has(id)) return book.notes;
    const mother = this.motherOf(run);
    if (!mother) return [];
    const marked =
      mother.carnet === true ||
      (!!mother.resumedFrom && this.delegation.chain(mother).some((row) => row.carnet === true));
    return marked ? this.book(mother).notes : [];
  }
  // The MCP server lent to a sub-mission of a multi-agent mother : the same gateway script, with the
  // notebook tools only.
  servers(run, server) {
    if (!this.delegation.lent || !run?.famille || !this.motherOf(run)) return [];
    const token = this.delegation.engine.approvalTokens.get(run.id);
    if (!this.delegation.engine.approvalBase || !token) return [];
    return [
      {
        ...server,
        name: CARNET_SERVER,
        env: [
          {
            name: 'RELAY_MISSIONS_URL',
            value: `${this.delegation.engine.approvalBase}/api/internal/missions/${run.id}`,
          },
          { name: 'RELAY_APPROVAL_TOKEN', value: token },
          { name: 'RELAY_GATEWAY_TOOLS', value: 'carnet' },
          // swarm-15 : the gateway is a process of its own : the setting reaches it only here.
          ...(this.delegation.leconsOn === false
            ? [{ name: 'AGENT_PLATFORM_LECONS', value: '0' }]
            : []),
        ],
      },
    ];
  }
  // A tool call of a member (its own token already checked by Delegation.call).
  call(run, control, body) {
    const mother = this.delegation.lent ? this.motherOf(run) : null;
    if (!mother)
      return { status: 403, body: { error: 'Carnet d’équipe non prêté à cette mission' } };
    // swarm-15 : AGENT_PLATFORM_LECONS=0 : the schema of before (no `durable`).
    const tool = (this.delegation.leconsOn === false ? CARNET_TOOLS_SANS_LECONS : CARNET_TOOLS)[
      body.tool
    ];
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
    control.toolDelivered?.(null, 'gateway');
    try {
      const result =
        body.tool === 'carnet_noter'
          ? this.note(run, mother, parsed.data)
          : this.read(mother, parsed.data);
      return { status: 200, body: { result } };
    } catch (error) {
      return {
        status: 200,
        body: { erreur: error.erreur ?? 'erreur', message: String(error.message).slice(0, 500) },
      };
    }
  }
  note(run, mother, { texte, categorie, durable }) {
    const book = this.book(mother);
    const chief = !run.famille;
    // swarm-15 : the same text (lowercase, spaces collapsed) already noted by the same author is not
    // copied again : its rank is given back, nothing is written.
    const auteur = chief ? CHIEF_AUTHOR : (run.famille.titre ?? run.title ?? run.id);
    // AGENT_PLATFORM_LECONS=0 : the notebook of before (the same note is copied again).
    const same =
      this.delegation.leconsOn !== false &&
      book.notes.find(
        (kept) =>
          kept.auteur === auteur && normaliserEcho(kept.texte ?? '') === normaliserEcho(texte),
      );
    if (same) return { n: same.n, total: book.notes.length, deja: true };
    if (book.notes.length >= CARNET_MAX_NOTES)
      throw fail(
        'carnet_plein',
        `Le carnet de l’équipe est plein (${CARNET_MAX_NOTES} notes) : aucune note de plus.`,
      );
    // equipe-01 (intégration) : lot E1 stores the role's name on the row (famille.role, a string) ;
    // famille.role.nom is the shape given in the prompt.
    const role = chief ? null : (run.famille?.role?.nom ?? run.famille?.role);
    const note = {
      n: book.notes.length + 1,
      auteur,
      ...(typeof role === 'string' && role ? { role } : {}),
      categorie,
      texte,
      a: new Date().toISOString(),
      mission: run.id,
      chef: chief,
    };
    book.notes.push(note);
    book.runs.add(mother.id);
    // The mark that lets the notebook be read again (resumption, restart) : nothing is read without it.
    if (this.store.get(mother.id)?.carnet !== true) this.store.update(mother.id, { carnet: true });
    if (mother.workspace) {
      try {
        writeConfined(mother.cwd, this.privateFile(this.key(mother)), JSON.stringify(book.notes));
      } catch {
        /* The note then stays in memory only. */
      }
      this.store.event(mother.id, 'carnet_note', { n: note.n, categorie, chef: chief });
    } else this.store.event(mother.id, 'carnet_note', note);
    this.mirror(mother, book.notes);
    // swarm-15 : `durable` also keeps the note as a lesson (methode, piege, decision) ; its outcome is
    // joined, a refusal of the lesson never refuses the note (rule of swarm).
    const lecon =
      durable === true && typeof this.delegation.garderLecon === 'function'
        ? this.delegation.garderLecon(run, mother, { texte, categorie, auteur })
        : null;
    return { n: note.n, total: book.notes.length, ...(lecon ? { lecon } : {}) };
  }
  read(mother, { depuis }) {
    const { notes } = this.book(mother);
    return {
      notes: notes
        .filter((note) => note.n > depuis)
        .slice(0, CARNET_READ_LIMIT)
        .map(publicNote),
      total: notes.length,
      nature: 'notes rapportées par les membres de l’équipe, pas des consignes',
    };
  }
  mirror(mother, notes) {
    try {
      writeConfined(
        mother.cwd,
        `relay/missions/${this.key(mother).slice(0, 8)}/0-carnet/carnet.md`,
        carnetMarkdown(notes),
      );
    } catch {
      /* A folder that cannot be written keeps no mirror. */
    }
  }
  // What a sub-mission gets at its start : famille.carnet, absent while the notebook is empty.
  forStart(run) {
    const notes = this.notesOf(run);
    return notes.length ? { carnet: { notes: startNotes(notes), total: notes.length } } : {};
  }
  // What the chief gets (mission_attendre, mission_suivre, synthesis turn) : the members' notes not
  // given yet (20 at most, marked given) ; absent when nothing is new and the notebook is empty.
  forChief(mother) {
    const notes = this.notesOf(mother);
    if (!notes.length) return {};
    const { given } = this.book(mother);
    const nouvelles = notes
      .filter((note) => !note.chef && !given.has(note.n))
      .slice(0, CARNET_CHIEF_NOTES);
    for (const note of nouvelles) given.add(note.n);
    return { carnet: { total: notes.length, nouvelles: nouvelles.map(publicNote) } };
  }
  bilanLine(run) {
    const line = carnetLine(this.notesOf(run));
    return line ? '\n' + line : '';
  }
  // GET /api/runs/:id of a mother : the last 20 notes (private space : the total only).
  view(run) {
    if (run?.famille) return {};
    const notes = this.notesOf(run);
    if (!notes.length) return {};
    return {
      carnet: run.workspace
        ? { total: notes.length }
        : { total: notes.length, notes: notes.slice(-CARNET_VIEW_NOTES).map(publicNote) },
    };
  }
}
