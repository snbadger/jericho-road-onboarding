// Thin wrapper around fetch for calling Supabase RPC functions.
// We deliberately don't pull in the Supabase JS SDK — the only operations we
// need are `rpc()` calls, and doing those over plain fetch keeps the site
// a single directory of static files with zero build step.

const SB = {
  url: CONFIG.SUPABASE_URL,
  key: CONFIG.SUPABASE_ANON_KEY,

  async rpc(fnName, args = {}) {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(args)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RPC ${fnName} failed (${res.status}): ${text}`);
    }

    return res.json();
  }
};

// ---- URL / token helpers ----

function getToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('t') || localStorage.getItem('jericho_token');
}

function setToken(token) {
  localStorage.setItem('jericho_token', token);
}

function clearToken() {
  localStorage.removeItem('jericho_token');
}

// ---- Admin token helpers ----

function getAdminToken() {
  return sessionStorage.getItem('jericho_admin_token');
}

function setAdminToken(token) {
  sessionStorage.setItem('jericho_admin_token', token);
}

function clearAdminToken() {
  sessionStorage.removeItem('jericho_admin_token');
}
