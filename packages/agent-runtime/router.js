// Auto mode: pick the most suitable available agent for declared requirements, and explain why.
// Never falls back to the fixture silently when real agents were requested.
export function requirementsFor({ resume = false, model = '', mcpTransport = 'stdio' } = {}) {
  return { loadSession: !!resume, model: model || null, mcpTransport };
}

export function chooseAgent({ agents, requirements, live, probes = {}, order = null }) {
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
  for (const a of agents.filter((x) => !x.simulated).sort((x, y) => rank(x) - rank(y))) {
    const probe = probes[a.id];
    if (!a.installed) rejected.push({ id: a.id, reason: 'CLI non détecté' });
    else if (!a.compatible)
      rejected.push({ id: a.id, reason: a.reason ?? 'Adaptateur ACP absent' });
    else if (probe && probe.session === false)
      rejected.push({
        id: a.id,
        reason: `Dernier test : session refusée (${probe.error ?? 'auth'})`,
      });
    else if (probe && probe.inference === false)
      rejected.push({
        id: a.id,
        reason: `Dernier prompt refusé (${probe.inferenceError ?? 'authentification'})`,
      });
    else if (requirements.loadSession && probe && !probe.capabilities?.loadSession)
      rejected.push({ id: a.id, reason: 'Reprise de session non annoncée' });
    else if (
      requirements.mcpTransport !== 'stdio' &&
      probe &&
      !probe.capabilities?.mcp?.[requirements.mcpTransport]
    )
      rejected.push({ id: a.id, reason: `Transport MCP ${requirements.mcpTransport} non annoncé` });
    else if (
      requirements.model &&
      probe &&
      !probe.models?.options?.some((m) => m.id === requirements.model)
    )
      rejected.push({ id: a.id, reason: `Modèle ${requirements.model} non annoncé` });
    else candidates.push(a);
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
