// Admin dashboard — create hires, list hires with completion progress, copy links

async function bootAdmin() {
  const adminToken = getAdminToken();

  if (!adminToken) {
    showLogin();
    return;
  }

  // Validate the stored token by hitting an admin RPC
  try {
    await SB.rpc('onboarding_admin_list_new_hires', { p_admin_token: adminToken });
    showDashboard();
  } catch (err) {
    clearAdminToken();
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login').classList.remove('hidden');
  document.getElementById('adminSignIn').addEventListener('click', async () => {
    const t = document.getElementById('adminInput').value.trim();
    if (!t) return;
    try {
      await SB.rpc('onboarding_admin_list_new_hires', { p_admin_token: t });
      setAdminToken(t);
      document.getElementById('login').classList.add('hidden');
      showDashboard();
    } catch (e) {
      document.getElementById('loginError').classList.remove('hidden');
    }
  });
}

async function showDashboard() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('signOutAdmin').classList.remove('hidden');
  document.getElementById('signOutAdmin').addEventListener('click', (e) => {
    e.preventDefault();
    clearAdminToken();
    window.location.reload();
  });

  await refreshHireList();

  document.getElementById('createForm').addEventListener('submit', onCreateHire);

  document.getElementById('loading').classList.add('hidden');
  document.getElementById('adminView').classList.remove('hidden');
}

async function onCreateHire(ev) {
  ev.preventDefault();
  const banner = document.getElementById('createResult');
  banner.className = 'banner info';
  banner.classList.remove('hidden');
  banner.textContent = 'Creating…';

  try {
    const result = await SB.rpc('onboarding_admin_create_new_hire', {
      p_admin_token: getAdminToken(),
      p_full_name: document.getElementById('new_full_name').value.trim(),
      p_preferred_name: document.getElementById('new_preferred_name').value.trim(),
      p_email: document.getElementById('new_email').value.trim(),
      p_job_title: document.getElementById('new_job_title').value.trim(),
      p_department: document.getElementById('new_department').value,
      p_start_date: document.getElementById('new_start_date').value,
      p_neo_date: document.getElementById('new_neo_date').value
    });

    const token = result.access_token;
    const link = `${new URL('.', window.location.href).href}?t=${token}`;

    banner.className = 'banner success';
    banner.innerHTML =
      `<strong>Created.</strong> Personal link (copy and email to them):<br>` +
      `<code class="copy-link">${escapeHtml(link)}</code><br>` +
      `<button class="btn secondary small" id="copyLinkBtn" style="margin-top:0.5rem">Copy link</button>`;

    document.getElementById('copyLinkBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(link).then(() => {
        document.getElementById('copyLinkBtn').textContent = 'Copied';
      });
    });

    document.getElementById('createForm').reset();
    await refreshHireList();

  } catch (err) {
    console.error(err);
    banner.className = 'banner error';
    banner.textContent = 'Could not create. Check all required fields and try again.';
  }
}

async function refreshHireList() {
  const wrap = document.getElementById('hireListWrap');
  wrap.innerHTML = '<p class="muted">Loading…</p>';

  try {
    const rows = await SB.rpc('onboarding_admin_list_new_hires', {
      p_admin_token: getAdminToken()
    });

    if (!rows || rows.length === 0) {
      wrap.innerHTML = '<p class="muted">No new hires yet. Add one above.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'admin-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Start</th>
          <th>NEO</th>
          <th>Modules</th>
          <th>Survey</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    rows.forEach(r => {
      const tr = document.createElement('tr');
      const link = `${new URL('.', window.location.href).href}?t=${r.access_token}`;
      const modulesLabel = `${r.modules_completed}/${r.modules_total}`;
      const modulesPct = r.modules_total ? Math.round((r.modules_completed / r.modules_total) * 100) : 0;

      tr.innerHTML = `
        <td><strong>${escapeHtml(r.full_name)}</strong>${r.preferred_name ? `<br><span class="small muted">${escapeHtml(r.preferred_name)}</span>` : ''}</td>
        <td>${escapeHtml(r.job_title || '—')}<br><span class="small muted">${escapeHtml(r.department || '')}</span></td>
        <td>${fmtDate(r.start_date)}</td>
        <td>${fmtDate(r.neo_date)}</td>
        <td><span style="font-weight:600;color:${modulesPct === 100 ? 'var(--success)' : 'var(--navy)'}">${modulesLabel}</span> <span class="small muted">(${modulesPct}%)</span></td>
        <td>${r.survey_completed ? '<span style="color:var(--success)">✓</span>' : '<span class="muted">—</span>'}</td>
        <td>
          <button class="btn secondary small copyBtn" data-link="${escapeHtml(link)}">Copy link</button>
          <button class="btn secondary small pdfBtn" data-id="${r.id}" title="Download attestation PDF" style="margin-top:0.25rem">PDF</button>
          <button class="btn danger small delBtn" data-id="${r.id}" data-name="${escapeHtml(r.full_name)}" style="margin-top:0.25rem">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    wrap.innerHTML = '';
    wrap.appendChild(table);

    wrap.querySelectorAll('.copyBtn').forEach(b => {
      b.addEventListener('click', (e) => {
        const l = e.target.dataset.link;
        navigator.clipboard.writeText(l).then(() => {
          e.target.textContent = 'Copied';
          setTimeout(() => { e.target.textContent = 'Copy link'; }, 1500);
        });
      });
    });

    wrap.querySelectorAll('.pdfBtn').forEach(b => {
      b.addEventListener('click', async (e) => {
        const btn = e.target;
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = '…';
        try { await downloadAttestationPDF(btn.dataset.id); }
        finally { btn.disabled = false; btn.textContent = orig; }
      });
    });

    wrap.querySelectorAll('.delBtn').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const name = e.target.dataset.name;
        if (!confirm(`Delete ${name}? This removes all progress and cannot be undone.`)) return;
        await SB.rpc('onboarding_admin_delete_new_hire', {
          p_admin_token: getAdminToken(),
          p_new_hire_id: id
        });
        await refreshHireList();
      });
    });

  } catch (err) {
    console.error(err);
    wrap.innerHTML = '<p class="banner error">Failed to load. Try refreshing.</p>';
  }
}

async function downloadAttestationPDF(hireId) {
  const detail = await SB.rpc('onboarding_admin_get_new_hire_detail', {
    p_admin_token: getAdminToken(),
    p_new_hire_id: hireId
  });
  if (!detail || !detail.new_hire) {
    alert('Could not load this hire\'s record.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const M = 54;            // 0.75" margin
  const PAGE_W = 612;
  let y = M;

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Pre-Boarding Training Attestation Record', M, y); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Morning Star Post Acute  ·  Jericho Care Group', M, y); y += 22;

  // Employee info
  const h = detail.new_hire;
  const info = [
    ['Employee', h.full_name + (h.preferred_name ? ` (${h.preferred_name})` : '')],
    ['Position', h.job_title || '—'],
    ['Department', h.department || '—'],
    ['Start date', h.start_date || '—'],
    ['NEO date', h.neo_date || '—']
  ];
  info.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold'); doc.text(k + ':', M, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(v), M + 90, y);
    y += 14;
  });
  y += 8;

  // Modules table
  const modules = detail.modules || [];
  const completedCount = modules.filter(({ progress: p }) => p && p.status === 'completed').length;
  const totalRequired = modules.filter(({ module: m }) => m.required).length;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(`Modules — ${completedCount} of ${totalRequired} required complete`, M, y); y += 6;

  const rows = modules.map(({ module: m, progress: p }) => {
    const status = p ? p.status : 'not_started';
    const completedAt = p && p.completed_at
      ? new Date(p.completed_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';
    const quiz = p && p.quiz_score != null ? `${p.quiz_score}/${p.quiz_total}` : '';
    return [m.title, status.replace('_', ' '), completedAt, quiz];
  });

  doc.autoTable({
    startY: y + 4,
    head: [['Module', 'Status', 'Completed', 'Quiz']],
    body: rows,
    styles: { fontSize: 9, cellPadding: 5, valign: 'middle' },
    headStyles: { fillColor: [27, 42, 74], textColor: 255 },
    columnStyles: { 0: { cellWidth: 240 }, 1: { cellWidth: 70 }, 2: { cellWidth: 130 }, 3: { cellWidth: 50 } },
    margin: { left: M, right: M }
  });
  y = doc.lastAutoTable.finalY + 18;

  // Survey
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('About-Me Survey:', M, y);
  doc.setFont('helvetica', 'normal');
  const surveyTxt = detail.survey && detail.survey.completed_at
    ? `Submitted ${new Date(detail.survey.completed_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}`
    : 'Not submitted';
  doc.text(surveyTxt, M + 110, y);
  y += 24;

  // Acknowledgment + signatures (start a new page if not enough room)
  if (y > 640) { doc.addPage(); y = M; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Acknowledgment', M, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(
    'The employee named above has completed the pre-boarding training items shown as complete. This record is filed in the personnel file as documentation of regulatory training.',
    M, y, { maxWidth: PAGE_W - 2 * M }
  );
  y += 36;

  const sigW = 240;
  const gap = 30;
  doc.line(M, y, M + sigW, y);
  doc.line(M + sigW + gap, y, M + sigW + gap + 130, y);
  y += 11;
  doc.text('Employee signature', M, y);
  doc.text('Date', M + sigW + gap, y);
  y += 30;

  doc.line(M, y, M + sigW, y);
  doc.line(M + sigW + gap, y, M + sigW + gap + 130, y);
  y += 11;
  doc.text('Director of Staff Development', M, y);
  doc.text('Date', M + sigW + gap, y);

  // Footer
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text(
    `Generated ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}  ·  jericho-road-onboarding`,
    M, 760
  );

  const safeName = h.full_name.replace(/[^A-Za-z0-9]+/g, '_');
  const datestr = new Date().toISOString().slice(0, 10);
  doc.save(`Onboarding_Attestations_${safeName}_${datestr}.pdf`);
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

document.addEventListener('DOMContentLoaded', bootAdmin);
