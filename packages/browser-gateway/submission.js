// apply-01 (E42, E26, E43): what the owner must see before approving a form submission, computed
// from the provider's submission preview and the described element. Never a field value, never the
// page text: the button's label, the form's action (host + path), the method, multipart or not, how
// many fields are filled, and whether a file field exists and holds a file.
const SKIPPED_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset', 'fieldset']);
const MAX_LABEL = 80;

export function summarizeSubmission(preview, element = null) {
  if (!preview || typeof preview !== 'object') return null;
  const label =
    [element?.text, element?.ariaLabel, element?.value]
      .map((value) =>
        String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .find(Boolean)
      ?.slice(0, MAX_LABEL) ?? null;
  let action = null;
  try {
    const url = new URL(preview.action);
    action = { host: url.host, path: url.pathname };
  } catch {
    /* no form, or a relative/invalid action: unknown */
  }
  const method = String(preview.method || 'get').toUpperCase();
  const multipart = /multipart/i.test(String(preview.enctype ?? ''));
  const fields = (Array.isArray(preview.fields) ? preview.fields : []).filter(
    (field) => field && !SKIPPED_TYPES.has(String(field.type ?? '')),
  );
  const fileFields = fields
    .filter((field) => field.type === 'file')
    .map((field) => ({
      name: field.name || null,
      files: (Array.isArray(field.files) ? field.files : []).map((file) =>
        String(file?.name ?? ''),
      ),
    }));
  const others = fields.filter((field) => field.type !== 'file');
  const filled = others.filter((field) =>
    ['checkbox', 'radio'].includes(field.type)
      ? field.checked === true
      : String(field.value ?? '').trim() !== '',
  ).length;
  const attached = fileFields.flatMap((field) => field.files).filter(Boolean);
  const attachment = !fileFields.length
    ? null
    : attached.length
      ? attached.join(', ')
      : 'champ fichier vide';
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  const text = [
    `Soumettre ${label ? `« ${label} »` : '(bouton sans libellé)'}${action ? ` → ${action.host}${action.path}` : ''}`,
    `${method}${multipart ? ' multipart' : ''}`,
    others.length
      ? `${plural(filled, 'champ')} ${filled > 1 ? 'remplis' : 'rempli'} sur ${others.length}`
      : null,
    !fileFields.length
      ? null
      : attached.length
        ? `pièce jointe : ${attached.join(', ')}`
        : 'champ fichier vide',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    label,
    action,
    method,
    multipart,
    filled,
    total: others.length,
    fileFields,
    attachment,
    text,
  };
}

// The approval card's title: the capability, the button's label as before (« Postuler »), then the
// submission summary without repeating the label.
export function submissionTitle(capability, submission) {
  const detail = submission.text.replace(
    /^Soumettre (?:« [^»]* »|\(bouton sans libellé\))\s?/u,
    '',
  );
  return `${capability}${submission.label ? ` « ${submission.label} »` : ''} · soumission ${detail}`;
}
