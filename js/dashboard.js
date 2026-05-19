// Dashboard (index.html) logic
// Loads the new hire's profile + module progress and renders the list.

async function loadDashboard() {
  const token = getToken();

  if (!token) {
    showInvalidState();
    return;
  }

  try {
    const [newHireRows, modules] = await Promise.all([
      SB.rpc('onboarding_get_new_hire', { p_token: token }),
      SB.rpc('onboarding_get_modules_with_progress', { p_token: token })
    ]);

    if (!newHireRows || newHireRows.length === 0) {
      showInvalidState();
      return;
    }

    // Valid token — persist in localStorage so URL doesn't need to carry it again
    setToken(token);

    const hire = newHireRows[0];
    renderHero(hire, modules);
    renderModules(modules, token);

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');

    document.getElementById('signOut').classList.remove('hidden');
    document.getElementById('signOut').addEventListener('click', (e) => {
      e.preventDefault();
      clearToken();
      window.location.href = window.location.pathname;
    });

  } catch (err) {
    console.error('Dashboard load failed', err);
    showInvalidState(err.message);
  }
}

function renderHero(hire, modules) {
  const displayName = hire.preferred_name || (hire.full_name || '').split(' ')[0] || 'traveler';
  document.getElementById('greetingName').textContent = displayName;

  if (hire.neo_date) {
    const d = new Date(hire.neo_date + 'T00:00:00');
    const fmt = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('neoDate').textContent = fmt;
    document.getElementById('heroSubtitle').innerHTML =
      `Your Day 1 is <strong>${fmt}</strong>. You're at Mile Marker 0 — the start of the Jericho Road.`;
  }

  const required = modules.filter(m => m.required);
  const completed = required.filter(m => m.status === 'completed').length;
  const pct = required.length === 0 ? 0 : Math.round((completed / required.length) * 100);

  document.getElementById('progressCount').textContent = `${completed} of ${required.length} complete`;
  document.getElementById('progressBarFill').style.width = pct + '%';

  if (required.length > 0 && completed === required.length) {
    document.getElementById('allDone').classList.remove('hidden');
  }
}

function renderModules(modules, token) {
  const list = document.getElementById('moduleList');
  list.innerHTML = '';

  modules.forEach((m, idx) => {
    const li = document.createElement('a');
    li.className = 'module-item' + (m.status === 'completed' ? ' completed' : '');

    // Route caregiver survey to its own page; all others to module.html
    if (m.slug === 'caregiver-survey') {
      li.href = `survey.html?t=${encodeURIComponent(token)}`;
    } else {
      li.href = `module.html?t=${encodeURIComponent(token)}&m=${encodeURIComponent(m.slug)}`;
    }

    const mile = document.createElement('div');
    mile.className = 'module-mile';
    mile.textContent = m.status === 'completed' ? '✓' : (idx + 1);

    const body = document.createElement('div');
    body.className = 'module-body';

    const title = document.createElement('p');
    title.className = 'module-title';
    title.textContent = m.title;
    body.appendChild(title);

    if (m.description) {
      const desc = document.createElement('p');
      desc.className = 'module-desc';
      const oneLine = m.description.replace(/\s+/g, ' ').trim();
      desc.textContent = oneLine.length > 150
        ? oneLine.slice(0, 150).trimEnd() + '…'
        : oneLine;
      body.appendChild(desc);
    }

    const meta = document.createElement('div');
    meta.className = 'module-meta';
    if (m.duration_minutes) {
      const t = document.createElement('span');
      t.textContent = `About ${m.duration_minutes} min`;
      meta.appendChild(t);
    }
    if (m.has_quiz) {
      const q = document.createElement('span');
      q.textContent = 'Includes a short quiz';
      meta.appendChild(q);
    }
    if (meta.children.length) body.appendChild(meta);

    const status = document.createElement('span');
    status.className = 'module-status ' + m.status;
    status.textContent = ({
      'not_started': 'Start',
      'in_progress': 'In progress',
      'completed': 'Complete'
    })[m.status] || m.status;

    li.appendChild(mile);
    li.appendChild(body);
    li.appendChild(status);

    list.appendChild(li);
  });
}

function showInvalidState(errorMsg) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('invalid').classList.remove('hidden');

  document.getElementById('manualTokenGo').addEventListener('click', () => {
    const t = document.getElementById('manualToken').value.trim();
    if (t) {
      window.location.href = window.location.pathname + '?t=' + encodeURIComponent(t);
    }
  });
}

document.addEventListener('DOMContentLoaded', loadDashboard);
