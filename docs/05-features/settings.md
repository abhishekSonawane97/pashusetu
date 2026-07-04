# Feature: Settings & Language — i18n Surface (F-12)

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 1.0 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-04 |
| **Depends on** | [../01-prd/README.md](../01-prd/README.md) (F-12) · [../04-business-rules/README.md](../04-business-rules/README.md) (BR-010, BR-013, BR-015, BR-055) · [../06-user-flows/README.md](../06-user-flows/README.md) (S-01, S-14, S-15, S-16) · [../16-legal/README.md](../16-legal/README.md) (§6 grievance, §8 retention/deletion) · [auth.md](auth.md) · [profile.md](profile.md) |

## Purpose

The one place a user manages their account and their language: S-15 hosts the profile-edit surface (F-02), the मराठी ↔ English switch (S-16, persisting D8's Marathi-first promise), notifications entry, help/grievance contact, legal links, about/version, logout, and the account-deletion request. It also owns the i18n plumbing every other feature consumes: the `mr.json` / `en.json` catalogs, fallback rules, and number formatting.

## User stories

- As a **Marathi-first farmer**, I want every screen in simple Marathi by default so I never depend on English.
- As a **trader comfortable in English**, I want to switch the whole app to English in two taps and have it stay that way on every device I log into.
- As a **user who is done with the platform**, I want a clear way to get my account and data deleted.
- As a **user with a problem**, I want a helpline number and a complaint channel I can find without hunting.

## Preconditions & permissions

| Aspect | Value |
|---|---|
| Who | S-15: any authenticated user (Profile tab is login-walled, doc 06 §5.2). **S-16 is public** — anonymous users switch language too (choice stored locally) |
| Login required | S-15 yes; S-16 no (route `/profile/language` is public, doc 06 §3.2) |
| Role | None (BR-011 — no role gates) |
| Completeness gate | Not required to open S-15/S-16; the profile-save itself follows [profile.md](profile.md). `PATCH /users/me` for `languagePref` needs only the User guard |

## UX workflow

1. **First run:** S-01 shows the language pick with **मराठी pre-selected** (D8; Marathi is the default for every first-time visitor regardless of browser locale — PRD F-12 AC-1). The choice is stored in localStorage; at signup it is sent as `languagePref` in `POST /users` ([profile.md](profile.md)).
2. **S-15 "माझे प्रोफाइल"** (Profile tab): profile fields pre-filled from `GET /users/me` and edited per [profile.md](profile.md) (phone read-only), followed by rows: **भाषा** (Language → S-16) · **सूचना** (Notifications → S-14) · **मदत व तक्रार** (Help & complaint) · **नियम व अटी** (Terms → `/terms`) · **गोपनीयता धोरण** (Privacy → `/privacy`) · **खाते हटवा** (Delete my account) · **लॉगआउट** (Logout) · footer "पशुसेतू — आवृत्ती {version}" (version = release build id, the commit-SHA release tag from the build, [../13-deployment/README.md](../13-deployment/README.md) §2.7).
3. **S-16 "भाषा बदला":** two radio rows — "मराठी" / "English". Picking one re-renders the UI **instantly** from the catalogs, fires `language_switch`, and persists: logged-in → `PATCH /api/v1/users/me { "languagePref": "MR"|"EN" }` (optimistic; revert + retry toast on failure); anonymous → localStorage only. Back → S-15 (or the S-01/host screen for anonymous entry).
4. **Sync rule:** on login, the server `language_pref` **wins** over any local value (PRD F-12 AC-2); the local copy is overwritten and kept as the render source while offline.
5. **मदत व तक्रार row:** opens a sheet with the helpline (`SUPPORT_PHONE` config; Marathi-speaking, Mon–Sat 10:00–18:00 IST — [../16-legal/README.md](../16-legal/README.md) §6.1) as a tap-to-call `tel:` link, the grievance e-mail `grievance@pashusetu.in`, and a link to the `/grievance` page. Complaints about a specific listing use the Report flow ([reporting.md](reporting.md)) — the primary grievance intake (doc 16 §6.2).
6. **खाते हटवा row:** opens a sheet — **no self-service delete API exists in MVP** (BR-015). Copy: "खाते हटवण्यासाठी आमच्या हेल्पलाइनवर फोन करा: {helpline}. ओळख पटवल्यानंतर ७ दिवसांच्या आत खाते हटवले जाते." (To delete your account, call our helpline: {helpline}. After identity verification the account is deleted within 7 days.) plus a plain-language summary of what is deleted vs retained (below) and a `tel:` CTA. Identity is verified by callback to the registered number (BR-015).
7. **लॉगआउट row:** confirm dialog "लॉगआउट करायचे का?" (Log out?) → Firebase client SDK `signOut()`, clear all locally cached user data (profile, favorites cache, notification badge, in-memory drafts) — the **local language choice is kept** so the UI stays in the user's language — then route to S-05; subsequent protected navigation redirects to `/login?returnTo=<path>` ([auth.md](auth.md) step 8).

### Account deletion — what happens (BR-015 + doc 16 §8, shown in the sheet in plain Marathi)

| Aspect | Value |
|---|---|
| Channel | Helpline call (also `grievance@pashusetu.in` / in-app help — doc 16 §8.2); verified by callback to the registered number |
| Timeline | Admin executes within **7 days** of the verified request (BR-015, BR-090 #20) — well inside the 30-day DPDP commitment (doc 16 §8.2) |
| Deleted | Firebase Auth user (future logins die); `favorites` and `notifications` rows; listing photos removed from R2 within 30 days; `users` row anonymized in place — `phone`/`firebase_uid` → `deleted:{id}`, `name` → "हटवलेला वापरकर्ता", `taluka`/`village` → null (BR-015) |
| Archived | All ACTIVE listings → `ARCHIVED` (T-12); one `moderation_log` entry (`AUTO_HIDE`, reason "account deletion request") |
| Retained & why | `interest_events`, `reports`, `moderation_log` referencing the anonymized user — fraud/audit trail, no PII after anonymization (BR-015); a minimal registration record for **180 days** post-deletion per IT Rules 3(1)(h), then hard-deleted; terminal listings follow the 36-month schedule (doc 16 §8.1) |
| After | Confirmation SMS (doc 16 §8.2); re-registration with the same number creates a **brand-new** account with zero history (BR-015). No temporary "pause" state exists — sellers archive listings instead |

## Fields & validation

| Field | Type | Required | Validation rule | Error message EN | Error message MR |
|---|---|---|---|---|---|
| languagePref | enum `MR\|EN` | Yes | Anything else → 400 `VALIDATION_ERROR` (bad enum, doc 08 §1.3); default `MR` (BR-010) | Choose a language | भाषा निवडा |
| name / districtId / taluka / village / isFarmer / isBuyer | — | — | Owned by [profile.md](profile.md) (same `PATCH /users/me`); validations and MR errors are specified there and not restated | — | — |
| phone | string | — | Immutable; sending it in `PATCH /users/me` → 400 `VALIDATION_ERROR` (API-03) | — (not editable) | — (बदलता येत नाही) |

## Business logic

- **Marathi default everywhere:** default locale is `MR` for every first-time visitor, deliberately overriding `Accept-Language` — D8, PRD F-12 AC-1; `users.language_pref` defaults `MR` at registration (BR-010).
- **Persistence & precedence:** anonymous choice lives in localStorage; logged-in choice lives in `users.language_pref` via `PATCH /users/me`; on conflict at login the **server value wins** and overwrites local — PRD F-12 AC-2.
- **Side effects of switching:** future WhatsApp prefills are generated in the new `language_pref` (BR-063, API-03 side effect); in-app notifications re-render in the new language at read time (F-11 edge); SMS remains Marathi-only (PRD F-11 AC-7). Breed/district names switch between `nameMr`/`nameEn` client-side (PRD F-12 AC-5) — user-generated text is never translated (BR-080).
- **Catalog rules:** 100% of user-facing strings come from `mr.json`/`en.json`; CI fails on a key missing from `mr.json`; runtime fallback mr → en → raw key with a Sentry warning — PRD F-12 AC-3/AC-4. Numbers render in Latin digits with Indian grouping (₹65,000) in both locales — PRD F-12 AC-6.
- **Offline:** the language switch is a server write for logged-in users, so offline it is disabled with "इंटरनेट नाही. पुन्हा प्रयत्न करा." (README §3.3 — no write queue); anonymous local-only switching works offline.
- **Deletion is helpline-mediated:** the Settings entry only informs and dials — the runbook is executed by the admin per BR-015; the anonymization keeps foreign-key integrity while removing PII; banned users may still request erasure (doc 16 §8.2).
- **Logout is client-side only:** no API call, no token revocation (session revocation is Phase 2, [auth.md](auth.md)); permissions die with the discarded token.
- **Grievance duties:** helpline + grievance contact rendered here satisfy the "published in Settings/footer" requirements of BR-015/BR-055 and doc 16 §6.1 (acknowledgment ≤ 24 h, resolution ≤ 15 days).

## API usage

| Method + path | When |
|---|---|
| `GET /api/v1/users/me` | On S-15 open — pre-fill profile fields and current `languagePref` |
| `PATCH /api/v1/users/me` | On S-16 pick (logged-in): `{ "languagePref": "MR"\|"EN" }`; on S-15 profile save: fields per [profile.md](profile.md) |
| `GET /api/v1/meta/districts` | On S-15 open, for the district picker (session-cached) |

Logout and account deletion call **no** `/api/v1` endpoint (Firebase client `signOut()`; helpline runbook per BR-015).

## States

| State | What the user sees |
|---|---|
| Loading | S-15: skeleton rows while `GET /users/me` loads; inline spinner in the save button during PATCH. S-16: never loads remotely — current value is already local. |
| Empty | Not applicable — S-15 always renders its rows; an anonymous Profile-tab tap opens the login wall, not an empty screen. |
| Error | PATCH failure on language → UI reverts to the previous language + retry toast "पुन्हा प्रयत्न करा"; profile-field errors inline per [profile.md](profile.md); offline → switch/save disabled with "इंटरनेट नाही. पुन्हा प्रयत्न करा." (no queue, README §3.3). |
| Success | Language: instant full re-render in the picked language (the confirmation *is* the re-render — no toast); profile save: toast "जतन झाले" (Saved). |
| Edge | **Local ≠ server at login:** server wins, local overwritten silently (PRD F-12 AC-2). **Missing translation key:** falls back mr → en → raw key + Sentry warning — never `undefined`. **Devanagari font missing on old devices:** self-hosted Noto Sans Devanagari with `font-display: swap`. **Two devices switch simultaneously:** last PATCH wins; other device adopts it on next `GET /users/me`. **Banned user:** S-15 is unreachable (API returns `USER_BANNED`); the banned block screen already shows the helpline/grievance contact (BR-014, README §3.2) — deletion still possible via helpline. |

## Analytics

| Event | Fired when | Properties |
|---|---|---|
| `language_switch` | On every effective switch on S-16 — after a 2xx PATCH for logged-in users; on local persist for anonymous users | `from` (`MR`\|`EN`), `to` (`MR`\|`EN`) |

`language_switch` is in the frozen NFR-10 list (README §3.4). Profile edits, logouts, and deletion requests fire no client event — server truth: `users.updated_at`, `users.language_pref` distribution, and the BR-015 runbook log via `GET /api/v1/admin/stats` / `moderation_log`.

## Acceptance criteria

1. A first-time visitor gets a fully Marathi UI regardless of device/browser language; S-01 shows मराठी pre-selected and stores the choice locally.
2. Picking a language on S-16 re-renders every visible string instantly from the catalogs, fires `language_switch` with `from`/`to`, and — for a logged-in user — persists via `PATCH /users/me` so a login on a second device renders in the same language.
3. For an anonymous user the choice survives app restarts (localStorage) and syncs into `languagePref` at signup; at any later login the server value wins over a divergent local value.
4. A failed `PATCH /users/me` on the language switch reverts the UI to the previous language and shows a retry toast; while offline the logged-in switch is disabled with the canonical offline copy.
5. The logout row signs out of the Firebase SDK, clears all cached user data while keeping the local language choice, lands on S-05, and any protected navigation then redirects to `/login?returnTo=<path>`.
6. The "खाते हटवा" sheet shows the helpline number as a tap-to-call link, the 7-day promise, and the deleted-vs-retained summary exactly per BR-015 — and performs no API call.
7. The help row exposes the helpline (`tel:` link, hours stated), `grievance@pashusetu.in`, and the `/grievance` link; the T&C and Privacy rows open `/terms` and `/privacy` in the active language (`/mr/*` variants for Marathi).
8. Numbers everywhere render as Latin digits with Indian grouping (₹65,000) in both locales, and a translation key missing from `mr.json` fails CI.

## Out of scope

- **Hindi locale** — Phase 2, gated on border-district traction (PRD F-12 future improvements).
- Per-type notification preferences / mute toggles — Phase 2 ([notifications.md](notifications.md)).
- Self-service one-tap account deletion endpoint — Phase 2; MVP is the BR-015 helpline runbook.
- Phone-number change, account merge, temporary deactivation — not in MVP (BR-010, BR-015).
- Theme (dark mode), font-size, and voice-guidance settings — Phase 2+; no MVP UI.
- Profile field validation and the S-04 creation flow — owned by [profile.md](profile.md).

## Acceptance checklist

- [x] Language switch specified end-to-end: S-01 default, S-16 mechanics, instant re-render, localStorage for anonymous, `PATCH /users/me` for logged-in, server-wins conflict rule (PRD F-12 AC-1/AC-2)
- [x] Profile-edit surface delegated to profile.md over the same `PATCH /users/me` (API-03); phone immutability restated; no field rules duplicated or contradicted
- [x] Logout semantics match auth.md (Firebase `signOut()` + local clear + S-05), with the language-retention decision stated
- [x] Account deletion matches BR-015 verbatim (helpline-mediated, 7-day execution, anonymization values, deleted/archived/retained split) and doc 16 §8 (30-day DPDP ceiling, 180-day registration record, confirmation SMS, banned-user erasure)
- [x] Helpline, grievance e-mail, `/grievance`, `/terms`, `/privacy` entries present per doc 16 §6.1 and BR-055; about/version row defined
- [x] Analytics limited to the frozen `language_switch` event; all other measurement server-side; all five states defined; ≥ 6 testable acceptance criteria; only canonical `/api/v1` paths used
