const $ = (id) => document.getElementById(id);
let catalog,
  planned,
  current,
  stream,
  selectedSkills = new Set(),
  sequence = 0;
const labels = {
  queued: 'En attente',
  running: 'En cours',
  waiting_permission: 'Autorisation requise',
  completed: 'Terminée',
  failed: 'Échec',
  cancelled: 'Annulée',
  interrupted: 'Interrompue',
};
const finalStates = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
function element(tag, text, className) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function error(e) {
  $('error').textContent = e.message ?? String(e);
  $('error').hidden = false;
  setTimeout(() => ($('error').hidden = true), 12000);
}
async function api(path, body) {
  const r = await fetch(
    '/api' + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}
function input() {
  return {
    prompt: $('prompt').value,
    agent: $('agent').value,
    pack: $('pack').value,
    skills: [...selectedSkills],
    model: $('model').value,
    mode: $('mode-select').value,
    budgetCents: 0,
  };
}
function invalidate() {
  planned = null;
  $('plan-panel').hidden = true;
}
function modeNote() {
  const real = catalog.live && !['fixture'].includes($('agent').value);
  $('execution-note').textContent = real
    ? 'Consommation BYOA externe · coût inconnu'
    : 'Données de test · aucun modèle appelé';
  renderModels(real);
}
function renderModels(real) {
  const agent = catalog.agents.find((a) => a.id === $('agent').value);
  const models = real ? (agent?.probe?.models ?? []) : [];
  const previous = $('model').value;
  $('model').replaceChildren(element('option', 'Par défaut du runtime'));
  $('model').firstChild.value = '';
  for (const m of models) {
    const o = element('option', m.name === m.id ? m.id : m.name + ' · ' + m.id);
    o.value = m.id;
    $('model').append(o);
  }
  $('model').value = models.some((m) => m.id === previous) ? previous : '';
  $('model').disabled = !real || !models.length;
  $('model-hint').textContent = !real
    ? 'disponible avec un agent réel'
    : models.length
      ? models.length + ' modèle(s) annoncé(s) au dernier test'
      : 'aucun modèle connu · lancer npm run test:live';
}
function agentStatus(a) {
  if (!a.installed) return ['absent', ''];
  if (!a.compatible) return ['incompatible', ''];
  if (a.probe?.session) return ['session validée', 'green'];
  if (a.probe && !a.probe.session) return ['authentification requise', ''];
  return ['détecté', 'green'];
}
const skillStates = {
  quarantined: 'Quarantaine · revue requise',
  reviewed: 'Revu · à installer',
  rejected: 'Rejeté',
  installed: 'Installé · inactif',
  active: 'Actif',
};
function renderThirdParty(s) {
  const row = element('div', undefined, 'skill third-party');
  row.append(
    element('strong', s.name),
    element('small', skillStates[s.state] ?? s.state),
    element(
      'small',
      (s.license ? 'Licence ' + s.license : 'Licence inconnue') + ' · ' + s.files + ' fichier(s)',
    ),
  );
  if (s.source?.url)
    row.append(
      element('small', s.source.url + (s.source.sha ? ' @ ' + s.source.sha.slice(0, 10) : '')),
    );
  for (const f of s.findings ?? [])
    row.append(element('small', '⚠ ' + f.message, 'finding finding-' + f.level));
  if (!s.integrity)
    row.append(
      element('small', 'Contenu modifié depuis l’import : réimporter', 'finding finding-danger'),
    );
  const act = (label, path, body) => {
    const b = element('button', label, 'secondary');
    b.type = 'button';
    b.onclick = async () => {
      try {
        catalog.skills = await api(path, body);
        renderSkills();
        invalidate();
      } catch (e) {
        error(e);
      }
    };
    row.append(b);
  };
  if (s.state === 'quarantined') {
    act('Approuver après lecture', '/skills/' + s.id + '/review', { approved: true });
    act('Rejeter', '/skills/' + s.id + '/review', { approved: false });
  }
  if (s.state === 'reviewed') act('Installer', '/skills/' + s.id + '/install', {});
  if (s.state === 'installed') act('Activer', '/skills/' + s.id + '/activate', { active: true });
  if (s.state === 'active') {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedSkills.has(s.id);
    checkbox.setAttribute('aria-label', 'Utiliser ' + s.name);
    checkbox.onchange = () => {
      checkbox.checked ? selectedSkills.add(s.id) : selectedSkills.delete(s.id);
      invalidate();
    };
    row.prepend(checkbox);
    act('Désactiver', '/skills/' + s.id + '/activate', { active: false });
  }
  return row;
}
function renderSkills() {
  $('skill-list').replaceChildren();
  for (const s of catalog.skills.filter((x) => x.origin === 'third-party'))
    $('skill-list').append(renderThirdParty(s));
  for (const s of catalog.skills.filter((x) => x.origin !== 'third-party')) {
    const row = element('div', undefined, 'skill');
    if (!s.installed || !s.integrity) {
      const b = element(
        'button',
        (s.installed ? 'Réinstaller après revue : ' : '+ Installer ') + s.name,
      );
      b.type = 'button';
      b.onclick = async () => {
        try {
          catalog.skills = await api('/skills/' + s.id + '/install', {});
          selectedSkills.add(s.id);
          renderSkills();
          invalidate();
        } catch (e) {
          error(e);
        }
      };
      row.append(b);
    } else {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedSkills.has(s.id) && s.active;
      checkbox.disabled = !s.active || !s.integrity;
      checkbox.setAttribute('aria-label', 'Utiliser ' + s.name);
      checkbox.onchange = () => {
        checkbox.checked ? selectedSkills.add(s.id) : selectedSkills.delete(s.id);
        invalidate();
      };
      const title = element('span', s.name);
      const toggle = element('button', s.active ? 'Désactiver' : 'Activer');
      toggle.type = 'button';
      toggle.onclick = async () => {
        try {
          catalog.skills = await api('/skills/' + s.id + '/activate', { active: !s.active });
          if (s.active) selectedSkills.delete(s.id);
          renderSkills();
          invalidate();
        } catch (e) {
          error(e);
        }
      };
      row.append(checkbox, title, element('small', 'v' + s.version), toggle);
      if (!s.integrity) row.append(element('small', 'Modifié — réinstaller après revue'));
    }
    $('skill-list').append(row);
  }
}
async function load() {
  catalog = await api('/catalog');
  $('mode').textContent = catalog.live ? 'BYOA réel activé' : 'Démonstration locale';
  $('agent').replaceChildren();
  for (const a of [{ id: 'auto', name: 'Auto', compatible: true }, ...catalog.agents]) {
    const option = element('option', a.name + (a.installed === false ? ' · non installé' : ''));
    option.value = a.id;
    option.disabled = !a.compatible || (!catalog.live && !['auto', 'fixture'].includes(a.id));
    $('agent').append(option);
  }
  $('agent').value = 'fixture';
  for (const p of catalog.packs) {
    const o = element('option', p.name);
    o.value = p.id;
    $('pack').append(o);
  }
  $('agents-list').replaceChildren();
  for (const a of catalog.agents.filter((a) => !a.simulated)) {
    const row = element('div', undefined, 'connection');
    const [status, tone] = agentStatus(a);
    row.append(element('span', '◈  ' + a.name), element('small', status, tone));
    row.title = [a.version ?? a.readiness, a.reason, a.probe?.error].filter(Boolean).join(' · ');
    $('agents-list').append(row);
  }
  selectedSkills = new Set(catalog.skills.filter((s) => s.active && s.integrity).map((s) => s.id));
  renderSkills();
  modeNote();
  await history();
}
async function history() {
  const runs = await api('/runs');
  $('history-list').replaceChildren();
  if (!runs.length)
    $('history-list').append(element('div', 'Votre première mission commence ici.', 'empty'));
  for (const r of runs) {
    const b = element('button', undefined, 'history-item');
    b.append(element('span', r.prompt), element('small', labels[r.state] ?? r.state));
    b.onclick = () => openRun(r.id);
    $('history-list').append(b);
  }
}
$('mission-form').onsubmit = async (event) => {
  event.preventDefault();
  $('plan-button').disabled = true;
  try {
    const candidate = input();
    const p = await api('/plan', candidate);
    planned = candidate;
    $('plan').replaceChildren(element('p', p.agent + ' · ' + p.pack));
    const ol = element('ol');
    p.steps.forEach((s) => ol.append(element('li', s)));
    const why = element('ul', undefined, 'routing');
    for (const r of p.routing?.reasons ?? []) why.append(element('li', r));
    for (const r of p.routing?.rejected ?? [])
      why.append(element('li', '✕ ' + r.id + ' : ' + r.reason, 'muted'));
    $('plan').append(
      why,
      ol,
      element('p', p.cost.description + ' · coût plateforme : 0 €'),
      element('p', p.permissions.join(' · ')),
    );
    $('plan-panel').hidden = false;
    $('plan-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    error(e);
  } finally {
    $('plan-button').disabled = false;
  }
};
$('launch').onclick = async () => {
  if (!planned) return;
  $('launch').disabled = true;
  try {
    const run = await api('/runs', planned);
    invalidate();
    await openRun(run.id);
    await history();
  } catch (e) {
    error(e);
  } finally {
    $('launch').disabled = false;
  }
};
const stepLabels = {
  pending: 'En attente',
  running: 'En cours',
  waiting_approval: 'Approbation requise',
  succeeded: 'Réussie',
  failed: 'Échec',
  skipped: 'Ignorée',
  cancelled: 'Annulée',
  uncertain: 'Incertaine · décision requise',
};
let workflowSteps = [];
function renderSteps(states = {}) {
  $('steps').hidden = !workflowSteps.length;
  $('steps').replaceChildren();
  for (const s of workflowSteps) {
    const st = states[s.id] ?? { state: 'pending' };
    const li = element('li', undefined, 'step step-' + st.state);
    li.append(
      element('strong', s.title),
      element(
        'small',
        [
          s.kind,
          s.agent,
          s.optional ? 'optionnelle' : null,
          s.effect === 'write' ? 'effet externe' : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
      element('span', stepLabels[st.state] ?? st.state, 'pill'),
    );
    if (st.error) li.append(element('small', st.error, 'muted'));
    const decide = (label, body) => {
      const b = element('button', label, 'secondary');
      b.onclick = async () => {
        try {
          await api('/runs/' + current + '/steps/' + s.id, body);
        } catch (e) {
          error(e);
        }
      };
      li.append(b);
    };
    if (st.state === 'waiting_approval') {
      decide('Approuver', { approved: true });
      decide('Refuser', { approved: false });
    }
    if (st.state === 'uncertain') {
      decide('Relancer', { action: 'retry' });
      decide('Marquer comme faite', { action: 'done' });
      decide('Marquer en échec', { action: 'fail' });
    }
    $('steps').append(li);
  }
}
let stepStates = {};
function renderResult(run) {
  $('result').replaceChildren();
  if (run.error) $('result').append(element('p', run.error));
  if (run.result) {
    $('result').append(
      element('span', run.result.simulated ? 'DONNÉES FICTIVES' : 'RÉSULTAT AGENT', 'pill'),
      element('p', run.result.summary),
    );
    for (const job of run.result.opportunities ?? []) {
      const row = element('div', undefined, 'job');
      row.append(
        element('span', job.score + ' points', 'score'),
        element('strong', job.title),
        element('small', job.company + ' · ' + job.location),
        element('p', job.reasons.join(' · ')),
        element('small', 'Sponsoring : non vérifié · Source de test : ' + job.source),
      );
      $('result').append(row);
    }
  }
  if (run.usage)
    $('result').append(
      element(
        'small',
        `Plateforme : ${run.usage.platformCents / 100} € · Consommation fournisseur : ${run.simulated ? 'aucun appel modèle' : 'inconnue (BYOA)'}`,
      ),
    );
  $('run-state').textContent = labels[run.state] ?? run.state;
  $('cancel').hidden = finalStates.has(run.state);
  $('resume').hidden = !run.resumable || !finalStates.has(run.state);
}
function permission(p) {
  const old = document.getElementById('permission-' + p.id);
  if (old) return;
  const row = element('div', undefined, 'permission');
  row.id = 'permission-' + p.id;
  row.append(
    element('strong', p.tool?.title ?? 'Autorisation agent'),
    element('pre', JSON.stringify(p.tool ?? {}, null, 2)),
  );
  for (const o of p.options) {
    const b = element('button', o.name, 'secondary');
    b.onclick = async () => {
      try {
        await api('/permissions/' + p.id, { optionId: o.optionId });
        row.remove();
      } catch (e) {
        error(e);
      }
    };
    row.append(b);
  }
  $('permissions').append(row);
}
async function openRun(id) {
  try {
    stream?.close();
    current = id;
    sequence = 0;
    $('events').textContent = '';
    workflowSteps = [];
    stepStates = {};
    $('permissions').replaceChildren();
    $('run-panel').hidden = false;
    const run = await api('/runs/' + id);
    workflowSteps = run.plan?.workflow?.steps ?? [];
    stepStates = Object.fromEntries(
      (run.steps ?? []).map((r) => [r.step_id, { state: r.state, error: r.error }]),
    );
    renderSteps(stepStates);
    renderResult(run);
    run.permissions?.forEach(permission);
    stream = new EventSource('/api/runs/' + id + '/events');
    stream.addEventListener('update', (event) => {
      const e = JSON.parse(event.data);
      if (e.seq <= sequence) return;
      sequence = e.seq;
      $('events').textContent += JSON.stringify(e) + '\n';
      if (e.type === 'state') {
        $('run-state').textContent = labels[e.data.state] ?? e.data.state;
      }
      if (e.type === 'permission') permission(e.data);
      if (e.type === 'workflow' && !workflowSteps.length) {
        workflowSteps = e.data.steps;
        renderSteps(stepStates);
      }
      if (e.type === 'step') {
        stepStates[e.data.stepId] = { state: e.data.state, error: e.data.error };
        renderSteps(stepStates);
      }
      if (e.type === 'permission_resolved')
        document.getElementById('permission-' + e.data.id)?.remove();
    });
    stream.addEventListener('end', async () => {
      stream?.close();
      const latest = await api('/runs/' + id);
      if (current === id) renderResult(latest);
      await history();
    });
    stream.onerror = () => {
      $('run-state').textContent = 'Reconnexion au flux…';
    };
    $('run-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    error(e);
  }
}
$('cancel').onclick = async () => {
  try {
    await api('/runs/' + current + '/cancel', {});
  } catch (e) {
    error(e);
  }
};
$('resume').onclick = async () => {
  try {
    const run = await api('/runs/' + current + '/resume', {});
    await openRun(run.id);
  } catch (e) {
    error(e);
  }
};
$('refresh').onclick = () => history().catch(error);
$('skill-import').onclick = async () => {
  try {
    $('skill-import').disabled = true;
    catalog.skills = await api('/skills/import', {
      git: $('skill-git').value.trim(),
      subdir: $('skill-subdir').value.trim() || '.',
    });
    renderSkills();
  } catch (e) {
    error(e);
  } finally {
    $('skill-import').disabled = false;
  }
};
$('example').onclick = () => {
  $('prompt').value =
    "Rechercher des offres d'emploi en Python et SQL en Australie, puis les classer.";
  $('pack').value = 'najah';
  invalidate();
};
for (const id of ['prompt', 'agent', 'pack', 'model', 'mode-select'])
  $(id).addEventListener('input', () => {
    invalidate();
    modeNote();
  });
load().catch(error);
