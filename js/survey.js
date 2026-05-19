// About Me caregiver survey — load existing responses, save draft, submit

let surveyToken = null;

async function loadSurvey() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t') || getToken();

  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  surveyToken = token;
  document.getElementById('backLink').href = `index.html?t=${encodeURIComponent(token)}`;

  try {
    // Verify token + pre-fill preferred name from new hire record
    const hireRows = await SB.rpc('onboarding_get_new_hire', { p_token: token });
    if (!hireRows || hireRows.length === 0) {
      alert("Your link is not valid. Returning to the homepage.");
      window.location.href = 'index.html';
      return;
    }

    const hire = hireRows[0];
    const existing = await SB.rpc('onboarding_get_caregiver_survey', { p_token: token });

    // Pre-populate
    const r = (existing && existing.responses) || {};
    if (r.preferred_name) {
      document.getElementById('preferred_name').value = r.preferred_name;
    } else if (hire.preferred_name) {
      document.getElementById('preferred_name').value = hire.preferred_name;
    }

    ['about_yourself','family_pets','hot_drink','cold_drink','snack','candy','allergies',
     'music','show','sports_team','relax','hobbies','why_career','why_morning_star',
     'good_at','hoping_to_learn','recognition_other','pet_peeves','nickname','bucket_list',
     'travel','dinner_guest','quote','anything_else'].forEach(key => {
      if (r[key] !== undefined) {
        const el = document.getElementById(key);
        if (el) el.value = r[key];
      }
    });

    if (Array.isArray(r.recognition)) {
      document.querySelectorAll('input[name="recognition[]"]').forEach(cb => {
        if (r.recognition.includes(cb.value)) cb.checked = true;
      });
    }

    if (existing && existing.completed_at) {
      document.getElementById('completedBanner').classList.remove('hidden');
      document.getElementById('submitBtn').textContent = 'Update my answers';
    }

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('surveyView').classList.remove('hidden');

    document.getElementById('saveDraftBtn').addEventListener('click', () => saveSurvey(false));
    document.getElementById('submitBtn').addEventListener('click', () => saveSurvey(true));

  } catch (err) {
    console.error('Survey load failed', err);
    document.getElementById('loading').innerHTML =
      '<p class="muted">We had trouble loading the survey. Please refresh and try again.</p>';
  }
}

function collectResponses() {
  const form = document.getElementById('surveyForm');
  const data = {};

  form.querySelectorAll('input[type="text"], textarea').forEach(el => {
    if (el.name && el.name !== 'recognition[]') data[el.name] = el.value.trim();
  });

  const recognition = Array.from(
    form.querySelectorAll('input[name="recognition[]"]:checked')
  ).map(cb => cb.value);
  data.recognition = recognition;

  return data;
}

async function saveSurvey(completed) {
  const banner = document.getElementById('saveBanner');
  banner.className = 'banner info';
  banner.classList.remove('hidden');
  banner.textContent = 'Saving…';

  // Completing the survey is equivalent to completing the caregiver-survey module,
  // so we update both records.
  try {
    const responses = collectResponses();

    await SB.rpc('onboarding_save_caregiver_survey', {
      p_token: surveyToken,
      p_responses: responses,
      p_completed: completed
    });

    if (completed) {
      await SB.rpc('onboarding_update_progress', {
        p_token: surveyToken,
        p_module_slug: 'caregiver-survey',
        p_status: 'completed',
        p_attestation_text: 'Completed About-Me Caregiver Survey.'
      });

      banner.className = 'banner success';
      banner.textContent = "Thank you — submitted. Returning to your dashboard…";
      setTimeout(() => {
        window.location.href = `index.html?t=${encodeURIComponent(surveyToken)}`;
      }, 1500);
    } else {
      banner.className = 'banner success';
      banner.textContent = 'Draft saved. You can come back any time before Day 1.';
    }

  } catch (err) {
    console.error('Survey save failed', err);
    banner.className = 'banner error';
    banner.textContent = 'We had trouble saving. Please try again.';
  }
}

document.addEventListener('DOMContentLoaded', loadSurvey);
