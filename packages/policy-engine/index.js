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
export function allowedPermission(options, optionId) {
  return options.some(
    (o) =>
      o.optionId === optionId && ['allow_once', 'reject_once', 'reject_always'].includes(o.kind),
  );
}
