# The Jericho Road — Pre-Boarding Website

**Morning Star Post Acute · Jericho Care Group**

A static website that gives every new Morning Star hire a personalized pre-boarding experience: watch videos, attest to training, take quizzes, and submit the About-Me Caregiver Survey before Day 1.

All progress is logged to Supabase so Yessi and Stephen can see cohort-level completion at a glance and so we have a CDPH-defensible training record.

---

## What's here

```
website/
├── index.html              New-hire dashboard (mile-marker progress)
├── module.html             Module detail — video + attestation + optional quiz
├── survey.html             About-Me Caregiver Survey
├── admin.html              Yessi/Stephen view — create hires + monitor progress
├── css/
│   └── styles.css          Jericho Road brand styles
├── js/
│   ├── config.js           Supabase URL + publishable key
│   ├── supabase-client.js  Thin fetch wrapper + token helpers
│   ├── dashboard.js        Logic for index.html
│   ├── module.js           Logic for module.html
│   ├── survey.js           Logic for survey.html
│   └── admin.js            Logic for admin.html
└── README.md               This file
```

No build step. No framework. No bundler. These are static HTML/CSS/JS files that work served from any static host.

---

## How it works

### New-hire flow

1. Yessi creates the new hire in the admin dashboard. The system generates a unique `access_token`.
2. Yessi copies the personal link (`https://site/?t=<token>`) and emails it to the new hire.
3. New hire opens the link, sees a personalized welcome with their name and Day-1 date, and a progress bar.
4. They click each module. Each module opens video + attestation (and optional quiz). Clicking "Mark complete" saves a timestamped record to Supabase.
5. The About-Me survey is its own module — opens a form, saves as draft or final submission.
6. On completion, their progress shows on the admin dashboard for Yessi.

### Authentication

**Token-based, no passwords.** The `access_token` in the URL is the credential. It's generated per new hire, stored in Supabase, and persisted to `localStorage` on first visit so the new hire doesn't need to click the emailed link every time.

**Why no full auth?** For a pre-boarding tool with 3–5 new hires per cohort, building email OTP + account creation adds friction that doesn't pay off. If security ever matters more (e.g. if we expand this to include PHI), swap tokens for Supabase Auth magic links — it's a one-day change.

### Admin access

The admin dashboard is protected by a simple admin token (stored server-side in `onboarding_is_admin()` — see migration). Yessi enters it once; it persists in `sessionStorage` for the browser session.

**To rotate the admin token:** apply a new migration updating the `onboarding_is_admin()` function.

---

## Supabase schema

Tables (all in `public`):

| Table | Purpose |
|---|---|
| `onboarding_cohorts` | NEO dates + cohort numbers |
| `onboarding_new_hires` | One row per new hire, with `access_token` |
| `onboarding_modules` | Content library (video, quiz, attestation flags) — seeded once |
| `onboarding_progress` | One row per new-hire × module — CDPH training record |
| `onboarding_caregiver_surveys` | About-Me responses as `jsonb` |

All tables have RLS enabled with no policies — direct access is blocked. All reads/writes go through `SECURITY DEFINER` RPC functions (below), so the publishable anon key in the browser is safe.

RPC functions:

| Function | Who calls it | Purpose |
|---|---|---|
| `onboarding_get_new_hire(token)` | New hire | Profile lookup |
| `onboarding_get_modules_with_progress(token)` | New hire | Module list + their progress |
| `onboarding_update_progress(token, slug, status, …)` | New hire | Mark in-progress / completed, save quiz + attestation |
| `onboarding_save_caregiver_survey(token, responses, completed)` | New hire | Save survey draft or submission |
| `onboarding_get_caregiver_survey(token)` | New hire | Reload existing survey responses |
| `onboarding_admin_list_new_hires(admin_token)` | Admin | List all hires with completion counts |
| `onboarding_admin_create_new_hire(admin_token, …)` | Admin | Create hire + auto-create cohort if needed |
| `onboarding_admin_delete_new_hire(admin_token, id)` | Admin | Hard-delete hire + cascading progress |
| `onboarding_admin_get_new_hire_detail(admin_token, id)` | Admin | Per-hire progress detail (for future detail page) |

---

## Local development

```bash
# From the repo root
python3 -m http.server 8094 --directory "01_Work/Jericho/Standard_Work/Orientation Documents/Jericho_Road_NEO/website"
# Then open http://localhost:8094
```

Or use the Claude preview server already configured:

```
.claude/launch.json → "jericho-road" → port 8094
```

## Editing content

### Adding or editing a module

1. In Supabase SQL Editor, `INSERT`/`UPDATE` the `onboarding_modules` table. Fields:
   - `slug` — URL-safe identifier (don't change after release)
   - `title`, `description`, `duration_minutes`
   - `video_url` — YouTube or Vimeo. Other hosts will pass through to the iframe as-is.
   - `has_attestation` — true shows the "I understand" checkbox + Mark Complete button
   - `has_quiz` — true shows a quiz before attestation; `quiz` field is a jsonb array of `{question, options[], correct_index}`
   - `display_order` — controls the order on the dashboard
   - `required` — non-required modules don't count toward completion percentage

2. No website redeploy needed. Next time a new hire refreshes, the new module appears.

### Rewording the attestation text

Edit `module.html` — the `<span id="attestText">…</span>` block. One redeploy needed.

### Rebranding colors

Edit `css/styles.css` — the `:root` variables at the top (`--navy`, `--gold`, `--cream`, etc.).

---

## Deployment — GitHub Pages

This site is published from its own repository:

- **Repo:** https://github.com/snbadger/jericho-road-onboarding
- **Live URL:** https://snbadger.github.io/jericho-road-onboarding/
- **Pages source:** `main` branch, root (`/`)

The site files live at the repo root (`index.html`, `module.html`, `survey.html`,
`admin.html`, `css/`, `js/`) — no build step.

### Updating

Push to the `main` branch of `jericho-road-onboarding` and GitHub Pages
redeploys automatically (usually within a minute).

This folder inside the `coworklocal` monorepo is the working source of record.
When you change it here, copy the changes into the `jericho-road-onboarding`
repo and push, or edit that repo directly.

### Custom domain (optional)

In the repo → Settings → Pages → Custom domain, add e.g.
`welcome.morningstarpostacute.com`, then add a DNS CNAME at your registrar
pointing to `snbadger.github.io`.

---

## Security notes

1. **The anon key in `config.js` is public and safe to commit.** Supabase anon keys are designed for browser use. All sensitive access is gated by RPC + RLS.
2. **The admin token is not in git.** It lives in the `onboarding_is_admin()` Postgres function. Rotate it via migration.
3. **No PHI is collected.** Name, email, job title, department, start date, and survey responses are not PHI. We deliberately don't ask for SSN, DOB, or medical info.
4. **New hire data persists on employee termination.** Consider a yearly cleanup migration to purge hires >1 year past their start date.

---

## Known TODOs

- [ ] Rotate the admin token before production use (currently `jericho-road-admin-2026`)
- [ ] Add the final video URLs for AB-40, Dementia, BBP, Infection Control (awaiting Yessi's picks)
- [ ] Add a per-hire detail page for admin (shows which specific modules they've completed; RPC exists)
- [ ] Email delivery integration — currently Yessi copies the link and pastes into Outlook manually
- [ ] Server-side printable PDF of completed attestations for personnel files

---

## Contact

Technical: ask Stephen or check the session logs in Supabase `session_logs` where `skills_used @> '["wrap"]'::jsonb` and title contains "Jericho Road".

Content / process: Yessi Flores, Director of Staff Development.
