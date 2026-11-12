// contrat-agents-01 : the one reader of an ACP tool call, whatever the adapter. Each consumer used
// to read the name and the arguments the way Claude's adapter gives them; four defects of the 12/11
// touched Codex only. Shapes seen in real missions (tests/fixtures/acp-shapes) :
//  - Claude : `name` / `title` / `_meta.claudeCode.toolName` = `mcp__platform__browser_click` ; the
//    input often arrives with a later update, flat (`rawInput.url`), whose title may quote the
//    command (Bash) while `_meta` still names the tool ;
//  - Codex : `title` = `mcp.platform.browser_click`, `rawInput` = `{ server, tool, arguments }`,
//    native commands named `exec_command` with the command as title.
// Returns `{ name, tool, server, input }` : the raw name, the bare tool (prefix of its MCP server
// removed), the server (null when the name carries none) and the arguments made flat. A free-text
// title is kept whole (never searched for a tool name it merely mentions).
const PREFIXED = /^mcp(?:__([A-Za-z0-9_-]+?)__|\.([A-Za-z0-9_-]+)\.)([A-Za-z][\w.-]*)$/;
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const object = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

export function readToolCall(update) {
  const raw = object(update?.rawInput) ?? object(update?.args);
  const nested = object(raw?.arguments);
  const input = { ...(raw ?? {}), ...(nested ?? {}) };
  // Codex : the MCP server and the tool travel with the input.
  if (text(raw?.server) && text(raw?.tool))
    return {
      name:
        text(update?.name) ?? text(update?.title) ?? `mcp.${text(raw.server)}.${text(raw.tool)}`,
      tool: text(raw.tool),
      server: text(raw.server),
      input,
    };
  const name =
    text(update?.name) ??
    text(update?._meta?.claudeCode?.toolName) ??
    text(update?.title) ??
    text(raw?.name) ??
    text(raw?.tool) ??
    '';
  const prefixed = name.match(PREFIXED);
  return {
    name,
    tool: prefixed ? prefixed[3] : name,
    server: prefixed ? (prefixed[1] ?? prefixed[2]) : null,
    input,
  };
}
