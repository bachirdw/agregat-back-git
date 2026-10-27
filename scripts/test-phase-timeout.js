export function testPhaseTimeoutMs(
  phase,
  configured = process.env.AGENT_PLATFORM_TEST_PHASE_TIMEOUT_MS,
) {
  const override = Number(configured);
  if (Number.isSafeInteger(override) && override > 0) return override;
  return phase === 'browser' ? 480000 : 240000;
}
