// Manual probe only: default handshake/session without inference; --api makes ONE tiny REST call.
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AcpRuntime, detectAgents } from '../packages/agent-runtime/index.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { CAREER_MODEL } from '../packages/career-ops/integration.js';
const root = new CareerWorkspace().path();
if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY absente');
const definition = (await detectAgents()).find((a) => a.id === 'gemini');
if (!definition?.installed || !definition.compatible) throw new Error('Gemini CLI indisponible');
const runtime = new AcpRuntime({
  definition: {
    ...definition,
    fixedEnv: {
      ...definition.fixedEnv,
      GEMINI_CLI_SYSTEM_SETTINGS_PATH: resolve(root, 'relay/gemini-settings.json'),
      CAREER_OPS_ROOT: root,
      CAREER_OPS_DATA_DIR: root,
      GEMINI_MODEL: CAREER_MODEL,
    },
  },
  cwd: root,
  agentHome: resolve(root, 'relay/agent-home'),
  ownerMode: true,
  onPermission: () => ({ outcome: { outcome: 'cancelled' } }),
});
try {
  await runtime.start();
  await runtime.session([]);
  await runtime.selectModel(CAREER_MODEL);
  console.log(
    JSON.stringify({
      handshake: true,
      session: true,
      model: runtime.models.current,
      mode: runtime.mode,
      nativePolicy: 'activation Skill seulement ; configuration système revue',
      paidCalls: 0,
    }),
  );
} finally {
  runtime.close();
}
if (process.argv.includes('--api')) {
  // Fail closed if the existing cumulative journal cannot be parsed, including after another session.
  const journal = '.manager/api-usage.md';
  const rows = readFileSync(journal, 'utf8')
    .split('\n')
    .filter((line) => /^\| \d\d:\d\d \|/.test(line));
  const last = rows.at(-1)?.split('|').at(-2);
  const cumulative = last?.match(/([\d.,]+)\s*\$.*?\((\d+) appels?\)/);
  if (!cumulative) throw new Error('Cumul API non lisible : revue du journal nécessaire');
  const dollars = Number(cumulative[1].replace(',', '.')),
    calls = Number(cumulative[2]);
  if (dollars + 0.01 >= 2 || calls + 1 >= 200) throw new Error('Budget API atteint');
  let usage,
    status = 'échec';
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CAREER_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Réponds OK.' }] }],
          generationConfig: { maxOutputTokens: 30, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      throw new Error(
        `API Gemini HTTP ${response.status} : ${String(failure.error?.message ?? '')
          .split(process.env.GEMINI_API_KEY)
          .join('[masqué]')
          .slice(0, 500)}`,
      );
    }
    const body = await response.json();
    usage = body.usageMetadata;
    status = 'réussi';
    console.log(
      JSON.stringify({
        api: true,
        model: CAREER_MODEL,
        status: response.status,
        usage,
        reply: body.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || '')
          .join('')
          .slice(0, 100),
      }),
    );
  } finally {
    const input = usage?.promptTokenCount,
      output = usage?.candidatesTokenCount;
    const cost = usage
      ? ((input || 0) * 0.25 + ((output || 0) + (usage.thoughtsTokenCount || 0)) * 1.5) / 1e6
      : 0.01;
    appendFileSync(
      journal,
      `| ${new Date().toTimeString().slice(0, 5)} | career-ops-01 | ${CAREER_MODEL} | REST « OK », ${status} ; session ACP sans inférence | ${input ?? 'inconnu'} / ${output ?? 'inconnu'} | ≤ ${cost.toFixed(6)} $ | ≤ ${(dollars + cost).toFixed(6)} $ (${calls + 1} appels) |\n`,
    );
  }
}
