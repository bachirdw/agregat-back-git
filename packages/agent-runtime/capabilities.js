// Normalises what different ACP agents announce into one shape the control plane can rely on.
// Two model mechanisms exist in the wild: stable `configOptions` (category "model") and the
// unstable `models` + `session/set_model` pair (Gemini CLI). Both are reported with their source.
const flatten = (options = []) => options.flatMap((o) => o.options ?? [o]);

export function sessionModels(session = {}) {
  const option = session.configOptions?.find((o) => o.category === 'model');
  if (option)
    return {
      source: 'configOptions',
      configId: option.id,
      current: option.currentValue ?? null,
      options: flatten(option.options).map((o) => ({ id: o.value, name: o.name ?? o.value })),
    };
  if (session.models?.availableModels)
    return {
      source: 'models',
      current: session.models.currentModelId ?? null,
      options: session.models.availableModels.map((m) => ({
        id: m.modelId,
        name: m.name ?? m.modelId,
      })),
    };
  return { source: null, current: null, options: [] };
}

export function sessionModes(session = {}) {
  const option = session.configOptions?.find((o) => o.category === 'mode');
  if (option)
    return {
      source: 'configOptions',
      configId: option.id,
      current: option.currentValue ?? null,
      options: flatten(option.options).map((o) => o.value),
    };
  if (session.modes?.availableModes)
    return {
      source: 'modes',
      current: session.modes.currentModeId ?? null,
      options: session.modes.availableModes.map((m) => m.id),
    };
  return { source: null, current: null, options: [] };
}

export function agentCapabilities(info = {}) {
  const c = info.agentCapabilities ?? {};
  return {
    loadSession: !!c.loadSession,
    // MCP over stdio is mandatory for every ACP agent; http/sse are optional.
    mcp: { stdio: true, http: !!c.mcpCapabilities?.http, sse: !!c.mcpCapabilities?.sse },
    image: !!c.promptCapabilities?.image,
    sessionList: !!c.sessionCapabilities?.list,
    sessionResume: !!c.sessionCapabilities?.resume,
    authMethods: (info.authMethods ?? []).map((m) => m.id),
  };
}
