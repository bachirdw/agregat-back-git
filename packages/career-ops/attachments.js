// apply-01 (E40): which CV the mission attached. The Bilan says « CV joint : adapté / brut / aucun » :
// adapté when the uploaded file is a PDF the Skill's chain produced (generate-pdf in this turn, or
// data/pdf-index.tsv / Relay's own record), brut otherwise (a PDF career_document rendered from
// cv.md, or any other file of the folder), aucun when a candidature was asked and nothing was
// attached. Names stay in memory for the classification; the Bilan never prints a file name.
import { basename } from 'node:path';
import { listProducedDocuments } from './produced-documents.js';

const TOOL = /^(?:mcp__[a-z0-9_]+?__)?(browser_upload|career_script|career_document)$/i;
const exitFailed = (output) => /exitCode\\*"?\s*:\s*[1-9]/.test(JSON.stringify(output ?? ''));
const APPLY_REQUESTED = /\b(?:postul(?:e|er|ez|ons)|candidatur(?:e|er)|apply|submit)\b/i;
const name = (value) => (typeof value === 'string' && value ? basename(value) : null);
// The gateway's JSON answer inside an ACP rawOutput/content, when there is one.
function answerOf(update) {
  const content = update.rawOutput?.content ?? update.content;
  const text = Array.isArray(content) ? content[0]?.text : undefined;
  try {
    return JSON.parse(typeof text === 'string' ? text : JSON.stringify(update.rawOutput ?? {}));
  } catch {
    return {};
  }
}

// Wraps a turn truth (createTurnTruth) without changing its contract: observe() and
// recordGatewayTool() still reach it, and cvAttachment() tells what was attached.
export function trackAttachments(truth, { root } = {}) {
  const names = new Map();
  const inputs = new Map();
  const uploads = new Set();
  const uploadsAttempted = new Set();
  const produced = new Set();
  const rendered = new Set();
  const observe = truth.observe.bind(truth);
  const recordGatewayTool = truth.recordGatewayTool.bind(truth);
  truth.observe = (update) => {
    if (['tool_call', 'tool_call_update'].includes(update?.sessionUpdate) && update.toolCallId) {
      const match = String(update.title ?? update.rawInput?.name ?? '')
        .trim()
        .match(TOOL);
      const tool = match ? match[1].toLowerCase() : names.get(update.toolCallId);
      if (tool) {
        names.set(update.toolCallId, tool);
        if (update.rawInput) inputs.set(update.toolCallId, update.rawInput);
        const raw = inputs.get(update.toolCallId) ?? {};
        const input = { ...raw, ...(raw.arguments ?? {}) };
        if (tool === 'browser_upload' && input.path) uploadsAttempted.add(name(input.path));
        if (update.status === 'completed') {
          const answer = answerOf(update);
          if (tool === 'browser_upload') uploads.add(name(answer.uploaded) ?? name(input.path));
          if (tool === 'career_script' && !exitFailed(update.rawOutput ?? update.content))
            for (const path of producedBy(input.command, input.args)) produced.add(name(path));
          if (tool === 'career_document' && (input.format === 'pdf' || answer.path))
            rendered.add(name(answer.path) ?? `${input.name ?? 'document'}.pdf`);
        }
      }
    }
    return observe(update);
  };
  truth.recordGatewayTool = (reportedName, status, extra = {}) => {
    const result = recordGatewayTool(reportedName, status, extra);
    const tool = String(reportedName).toLowerCase();
    if (tool === 'browser_upload' && status === 'completed' && name(extra.uploaded))
      uploads.add(name(extra.uploaded));
    if (tool === 'career_script' && status === 'completed' && name(extra.produced))
      produced.add(name(extra.produced));
    if (tool === 'career_document' && status === 'completed' && name(extra.rendered))
      rendered.add(name(extra.rendered));
    return result;
  };
  truth.cvAttachment = () => {
    const tailored = new Set(produced);
    if (root)
      for (const document of listProducedDocuments(root))
        if (document.tailored) tailored.add(document.name);
    const attached = [...uploads].filter(Boolean);
    const kind = !attached.length
      ? 'aucun'
      : attached.some((file) => tailored.has(file))
        ? 'adapté'
        : 'brut';
    return {
      kind,
      attached: attached.length,
      attempted: uploadsAttempted.size,
      viaCareerDocument: kind === 'brut' && attached.some((file) => rendered.has(file)),
    };
  };
  return truth;
}

// The PDF a document step of the Skill's chain writes, from its arguments.
export function producedBy(command, args = []) {
  if (!Array.isArray(args)) return [];
  if (command === 'generate-pdf') {
    const pdf = args.filter((a) => typeof a === 'string' && !a.startsWith('-'))[1];
    return pdf ? [pdf] : [];
  }
  if (command === 'generate-cover-letter') {
    const out = args.indexOf('--out');
    return out >= 0 && typeof args[out + 1] === 'string' ? [args[out + 1]] : [];
  }
  return [];
}

// One line of the career Bilan, or nothing when the truth is not tracked or no candidature was
// asked and nothing was attached.
export function cvAttachmentLine(truth, requested = '') {
  const attachment = truth?.cvAttachment?.();
  if (!attachment) return '';
  if (attachment.kind === 'aucun' && !APPLY_REQUESTED.test(String(requested))) return '';
  const detail =
    attachment.kind === 'adapté'
      ? ' (PDF de la chaîne du Skill)'
      : attachment.kind === 'brut'
        ? attachment.viaCareerDocument
          ? ' (PDF rendu depuis cv.md par career_document, pas le CV adapté de la chaîne du Skill)'
          : ' (fichier du dossier, pas le CV adapté de la chaîne du Skill)'
        : '';
  return `\n- CV joint : ${attachment.kind}${detail}.`;
}
