import { isAbsolute, relative, resolve } from 'node:path';
import { toolCallName } from './tool-guard.js';

// E63 : what the agent did with its own tools, outside the platform's gateway — file writes,
// deletions and moves, commands, web fetches — is told in the Bilan, which must say the real
// actions. Nothing is restricted : the platform only counts the calls that completed, by their ACP
// kind (ToolKind), and says how many files were outside the mission's folder. No path, command
// or URL leaves this module.
const KINDS = [
  ['edit', 'écriture de fichier', 'écritures de fichiers'],
  ['delete', 'suppression de fichier', 'suppressions de fichiers'],
  ['move', 'déplacement de fichier', 'déplacements de fichiers'],
  ['execute', 'commande', 'commandes'],
  ['fetch', 'accès web', 'accès web'],
];
const FILE_KINDS = new Set(['edit', 'delete', 'move']);
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
// The platform's own gateway tools, as adapters name them with or without their MCP prefix : the
// pack's Bilan tells them, they are never native actions.
const GATEWAY_TOOL =
  /^(?:mcp__[a-z0-9_]+?__)?(?:browser[_.]\w+|career_\w+|watch_\w+|email_send|linkedin_draft|jobs_search_live|activate_skill|evidence_echo|google_web_search)$/i;

export class NativeActions {
  // `isPlatform(update)` : whether a call is one of the platform's own tools (left to the pack's
  // Bilan) ; `folder` : the mission's working folder.
  constructor({ folder, isPlatform = () => false } = {}) {
    this.folder = typeof folder === 'string' && folder ? resolve(folder) : null;
    this.isPlatform = isPlatform;
    this.calls = new Map(); // toolCallId -> { kind, paths, platform, counted }
    this.counts = new Map(); // kind -> { done, outside }
  }
  observe(update) {
    if (!['tool_call', 'tool_call_update'].includes(update?.sessionUpdate) || !update.toolCallId)
      return;
    let call = this.calls.get(update.toolCallId);
    if (!call) {
      if (this.calls.size >= 4000) return;
      call = { kind: null, paths: new Set(), platform: false, counted: false };
      this.calls.set(update.toolCallId, call);
    }
    if (typeof update.kind === 'string') call.kind = update.kind;
    if (this.isPlatform(update) || GATEWAY_TOOL.test(toolCallName(update))) call.platform = true;
    for (const location of Array.isArray(update.locations) ? update.locations : [])
      if (typeof location?.path === 'string') call.paths.add(location.path);
    const input = update.rawInput ?? {};
    for (const key of ['file_path', 'notebook_path', 'path'])
      if (typeof input[key] === 'string') call.paths.add(input[key]);
    if (!TERMINAL.has(update.status) || call.counted) return;
    call.counted = true;
    if (update.status !== 'completed' || call.platform || !KINDS.some(([k]) => k === call.kind))
      return;
    const count = this.counts.get(call.kind) ?? { done: 0, outside: 0 };
    count.done++;
    if (FILE_KINDS.has(call.kind) && [...call.paths].some((path) => this.outside(path)))
      count.outside++;
    this.counts.set(call.kind, count);
  }
  outside(path) {
    if (!this.folder) return false;
    const target = isAbsolute(path) ? resolve(path) : resolve(this.folder, path);
    const inside = relative(this.folder, target);
    return inside === '..' || inside.startsWith('../') || isAbsolute(inside);
  }
  // The Bilan's line, or '' when the agent used none of these tools.
  line() {
    const parts = [];
    for (const [kind, one, many] of KINDS) {
      const count = this.counts.get(kind);
      if (!count?.done) continue;
      parts.push(
        `${count.done} ${count.done > 1 ? many : one}${
          count.outside ? ` (dont ${count.outside} hors du dossier de la mission)` : ''
        }`,
      );
    }
    return parts.length
      ? `\nActions natives de l’agent (hors outils de la plateforme) : ${parts.join(', ')}.`
      : '';
  }
}
