// Module detail page: video + optional quiz + attestation

let state = {
  token: null,
  module: null,
  quizAnswers: {},
  quizGraded: false,
  quizScore: null,
  quizTotal: null
};

async function loadModule() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t') || getToken();
  const moduleSlug = params.get('m');

  if (!token || !moduleSlug) {
    window.location.href = 'index.html';
    return;
  }

  state.token = token;
  document.getElementById('backLink').href = `index.html?t=${encodeURIComponent(token)}`;

  try {
    const modules = await SB.rpc('onboarding_get_modules_with_progress', { p_token: token });
    const mod = modules.find(m => m.slug === moduleSlug);

    if (!mod) {
      alert("We couldn't find that module. Returning to your dashboard.");
      window.location.href = `index.html?t=${encodeURIComponent(token)}`;
      return;
    }

    state.module = mod;
    render();

    // Mark as in_progress on first view
    if (mod.status === 'not_started') {
      await SB.rpc('onboarding_update_progress', {
        p_token: token,
        p_module_slug: moduleSlug,
        p_status: 'in_progress'
      });
    }

  } catch (err) {
    console.error('Module load failed', err);
    document.getElementById('loading').innerHTML =
      '<p class="muted">We had trouble loading this module. Please refresh and try again.</p>';
  }
}

function render() {
  const m = state.module;

  document.getElementById('moduleNumber').textContent = m.display_order;
  document.getElementById('moduleTitle').textContent = m.title;
  const descEl = document.getElementById('moduleDesc');
  descEl.innerHTML = '';
  (m.description || '').split(/\n{2,}/).forEach(para => {
    para = para.trim();
    if (!para) return;
    const p = document.createElement('p');
    para.split('\n').forEach((line, i) => {
      if (i > 0) p.appendChild(document.createElement('br'));
      p.appendChild(document.createTextNode(line));
    });
    descEl.appendChild(p);
  });

  // Video
  if (m.video_url) {
    const embedUrl = toEmbedUrl(m.video_url);
    if (embedUrl) {
      document.getElementById('videoFrame').src = embedUrl;
      document.getElementById('videoWrap').classList.remove('hidden');
    }
  }

  // Quiz
  if (m.has_quiz && m.quiz && Array.isArray(m.quiz)) {
    renderQuiz(m.quiz);
    document.getElementById('quizBlock').classList.remove('hidden');
  }

  // Attestation (unless quiz-only modules — but all modules here have attestation or quiz)
  if (m.has_attestation) {
    document.getElementById('attestationBlock').classList.remove('hidden');
    const cb = document.getElementById('attestCheck');
    const btn = document.getElementById('completeBtn');
    cb.addEventListener('change', () => { btn.disabled = !cb.checked; });
    btn.addEventListener('click', completeModule);
  } else if (m.has_quiz) {
    // Quiz-only module: completion happens after successful quiz
    document.getElementById('attestationBlock').classList.add('hidden');
  }

  // If already completed, show a nudge
  if (m.status === 'completed') {
    const cb = document.getElementById('attestCheck');
    const btn = document.getElementById('completeBtn');
    cb.checked = true;
    btn.disabled = false;
    btn.textContent = 'Already complete — mark again?';
  }

  document.getElementById('loading').classList.add('hidden');
  document.getElementById('moduleView').classList.remove('hidden');
}

function renderQuiz(questions) {
  const wrap = document.getElementById('quizQuestions');
  wrap.innerHTML = '';

  questions.forEach((q, qIdx) => {
    const box = document.createElement('div');
    box.className = 'quiz-question';

    const title = document.createElement('p');
    title.className = 'q-text';
    title.textContent = `${qIdx + 1}. ${q.question}`;
    box.appendChild(title);

    q.options.forEach((opt, optIdx) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `q${qIdx}`;
      input.value = optIdx;
      input.addEventListener('change', () => {
        state.quizAnswers[qIdx] = optIdx;
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + opt));
      box.appendChild(label);
    });

    wrap.appendChild(box);
  });

  const gradeBtn = document.createElement('button');
  gradeBtn.className = 'btn';
  gradeBtn.textContent = 'Check my answers';
  gradeBtn.addEventListener('click', () => gradeQuiz(questions));
  wrap.appendChild(gradeBtn);
}

function gradeQuiz(questions) {
  let correct = 0;
  questions.forEach((q, qIdx) => {
    if (state.quizAnswers[qIdx] === q.correct_index) correct++;
  });

  state.quizGraded = true;
  state.quizScore = correct;
  state.quizTotal = questions.length;

  const result = document.getElementById('quizResult');
  const pct = Math.round((correct / questions.length) * 100);
  const pass = pct >= 70;

  result.className = 'banner ' + (pass ? 'success' : 'info');
  result.classList.remove('hidden');
  result.innerHTML = pass
    ? `<strong>You got ${correct} of ${questions.length} right (${pct}%).</strong> Nice work — you can mark this module complete below. We'll go deeper on Day 1.`
    : `<strong>You got ${correct} of ${questions.length} right (${pct}%).</strong> That's okay — you can try again, or continue. We'll re-test on Day 1. Take a minute to review, then either retry or proceed.`;

  // Don't block completion on quiz score — Day 1 post-test is the gate
  // Just allow attestation now
}

async function completeModule() {
  const btn = document.getElementById('completeBtn');
  btn.disabled = true;
  document.getElementById('saveStatus').textContent = 'Saving…';

  const attestationText = document.getElementById('attestText').textContent.trim();

  try {
    await SB.rpc('onboarding_update_progress', {
      p_token: state.token,
      p_module_slug: state.module.slug,
      p_status: 'completed',
      p_attestation_text: attestationText,
      p_quiz_score: state.quizGraded ? state.quizScore : null,
      p_quiz_total: state.quizGraded ? state.quizTotal : null,
      p_quiz_answers: state.quizGraded ? JSON.stringify(state.quizAnswers) : null
    });

    document.getElementById('saveStatus').textContent = '';
    document.getElementById('attestationBlock').classList.add('hidden');
    document.getElementById('quizBlock').classList.add('hidden');
    document.getElementById('doneBanner').classList.remove('hidden');

    setTimeout(() => {
      window.location.href = `index.html?t=${encodeURIComponent(state.token)}`;
    }, 1500);

  } catch (err) {
    console.error('Save failed', err);
    btn.disabled = false;
    document.getElementById('saveStatus').textContent = 'Save failed — please try again.';
  }
}

// Convert common video URLs to embeddable URLs
function toEmbedUrl(url) {
  try {
    const u = new URL(url);

    // YouTube watch / short / shorts
    if (u.hostname.includes('youtube.com')) {
      const vid = u.searchParams.get('v');
      if (vid) return `https://www.youtube.com/embed/${vid}`;
      if (u.pathname.startsWith('/embed/')) return url;
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return `https://www.youtube.com/embed/${id}`;
      }
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${id}`;
    }

    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.replace('/', '');
      if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }

    // Unknown — just let the iframe try the raw URL
    return url;
  } catch (e) {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', loadModule);
