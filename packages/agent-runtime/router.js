// Auto mode: pick the most suitable available agent for declared requirements, and explain why.
// Never falls back to the fixture silently when real agents were requested.
export function requirementsFor({ resume = false, model = '', mcpTransport = 'stdio' } = {}) {
  return { loadSession: !!resume, model: model || null, mcpTransport };
}

// A negative probe is a hint, not a sentence: it stops counting after this delay (a transient network
// failure or a login since renewed must not exclude an agent for good), and a later success rewrites it.
export const PROBE_TTL_MS = 10 * 60 * 1000;
const fresh = (at, fallbackAt, now) => {
  const t = Date.parse(at ?? fallbackAt ?? '');
  return !Number.isFinite(t) || now - t < PROBE_TTL_MS; // undated probes stay in force
};

export function chooseAgent({
  agents,
  requirements,
  live,
  probes = {},
  order = null,
  now = Date.now(),
}) {
  const rejected = [];
  if (!live) {
    const fixture = agents.find((a) => a.simulated);
    return {
      id: fixture.id,
      reasons: ['Mode démonstration : agents réels désactivés (AGENT_PLATFORM_LIVE=1 requis)'],
      rejected: agents
        .filter((a) => !a.simulated)
        .map((a) => ({ id: a.id, reason: 'Mode réel désactivé' })),
    };
  }
  const rank = (a) => (order?.includes(a.id) ? order.indexOf(a.id) : 100 + (a.preference ?? 50));
  const candidates = [];
  const retryable = []; // agents set aside only on the strength of a negative probe
  for (const a of agents.filter((x) => !x.simulated).sort((x, y) => rank(x) - rank(y))) {
    const probe = probes[a.id];
    if (!a.installed) rejected.push({ id: a.id, reason: 'CLI non détecté' });
    else if (!a.compatible)
      rejected.push({ id: a.id, reason: a.reason ?? 'Adaptateur ACP absent' });
    else if (probe && probe.session === false && fresh(probe.sessionAt, probe.at, now)) {
      rejected.push({
        id: a.id,
        reason: `Dernier test : session refusée (${probe.error ?? 'auth'})`,
      });
      retryable.push(a);
    } else if (probe && probe.inference === false && fresh(probe.inferenceAt, probe.at, now)) {
      rejected.push({
        id: a.id,
        reason: `Dernier prompt refusé (${probe.inferenceError ?? 'authentification'})`,
      });
      retryable.push(a);
    } else if (requirements.loadSession && !probe?.capabilities?.loadSession)
      rejected.push({ id: a.id, reason: 'Reprise de session non annoncée' });
    else if (
      requirements.mcpTransport !== 'stdio' &&
      !probe?.capabilities?.mcp?.[requirements.mcpTransport]
    )
      rejected.push({ id: a.id, reason: `Transport MCP ${requirements.mcpTransport} non annoncé` });
    else if (
      requirements.model &&
      !probe?.models?.options?.some((m) => m.id === requirements.model)
    )
      rejected.push({ id: a.id, reason: `Modèle ${requirements.model} non annoncé` });
    else candidates.push(a);
  }
  // Every remaining agent is excluded by a negative probe only: try the best one again rather than
  // leaving Auto without any agent (a success then rehabilitates it in the probe file).
  if (!candidates.length && retryable.length && retryable.length === rejected.length) {
    const again = retryable[0];
    const reason = rejected.find((r) => r.id === again.id).reason;
    return {
      id: again.id,
      reasons: [
        `${again.name} ${again.version ?? ''} réessayé : seul agent disponible, ${reason}`.replace(
          /\s+/g,
          ' ',
        ),
      ],
      rejected: rejected.filter((r) => r.id !== again.id),
    };
  }
  if (!candidates.length) {
    const error = new Error(
      'Aucun agent réel compatible : ' + rejected.map((r) => `${r.id} (${r.reason})`).join(', '),
    );
    error.rejected = rejected;
    throw error;
  }
  const chosen = candidates[0];
  const probe = probes[chosen.id];
  return {
    id: chosen.id,
    reasons: [
      `${chosen.name} ${chosen.version ?? ''} détecté et compatible ACP`.replace(/\s+/g, ' '),
      probe?.inference
        ? `Inférence validée au dernier test (${probe.at ?? 'date inconnue'})`
        : probe
          ? `Session validée au dernier test (${probe.at ?? 'date inconnue'}) ; inférence non encore prouvée`
          : 'Jamais testé : handshake et authentification vérifiés au lancement',
      ...(requirements.model ? [`Modèle ${requirements.model} demandé`] : []),
      ...(requirements.loadSession ? ['Reprise de session requise'] : []),
    ],
    rejected,
  };
}
