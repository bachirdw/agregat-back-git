export function browserPolicy(action, url) {
  if (!['browser.navigate', 'browser.snapshot', 'browser.extract'].includes(action))
    throw new Error('Action navigateur refusée : lecture seule');
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'jobs.example.test' ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    throw new Error('Domaine navigateur non autorisé');
  return true;
}
// accord-mission-01 (13/11) : `allow_mission` grants every send of the mission in progress (offered
// by the platform only, see gatewayApproval). `allow_always` stays refused : no grant outlives a mission.
export const PERMISSION_KINDS = ['allow_once', 'allow_mission', 'reject_once', 'reject_always'];
export function allowedPermission(options, optionId) {
  return options.some((o) => o.optionId === optionId && PERMISSION_KINDS.includes(o.kind));
}
