# Feature: User Profile (F-02)

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 1.1 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-14 |
| **Depends on** | [../01-prd/README.md](../01-prd/README.md) (F-02) · [../04-business-rules/README.md](../04-business-rules/README.md) (BR-010, BR-011, BR-013) · [../06-user-flows/README.md](../06-user-flows/README.md) (Flow A/D, S-04, S-15) · [auth.md](auth.md) |

## Purpose

A minimal, mostly-tap profile — name, district, optional taluka/village, role flags, language — created in under a minute after first login. Location powers search relevance and buyer trust; the name humanizes the contact moment. Phone comes from Firebase and is never editable.

## User stories

- As a **first-time user**, I want to set up my profile with mostly taps (not typing) so I can start selling or browsing immediately.
- As a **farmer who moved talukas**, I want to update my location so buyers see where the animal actually is.
- As a **buyer**, I want my district saved so search feels local by default.

## Preconditions & permissions

| Aspect | Value |
|---|---|
| Who | Any authenticated Firebase user (S-04 for creation; S-15 for edits) |
| Login required | Yes (F-01) |
| Role | None — every account gets both role flags (BR-011) |
| Completeness gate | Profile is **complete** when `name` and `district_id` are set (BR-013). Every authenticated write elsewhere requires completeness (403 `PROFILE_INCOMPLETE` → redirect here) |

## UX workflow

1. The single Profile route `/profile` resolves via `GET /users/me` into one of three modes rather than always rendering the create form: **setup** (404 → first login → the **S-04** create form, header "तुमची माहिती भरा", subtitle "फक्त नाव आणि जिल्हा — एका मिनिटात पूर्ण होईल.", primary button "पुढे जा", opened with `returnTo` preserved); **view** (200 → the returning-user default, a read-only card — see step 6); **edit** (opened from view). Screen IDs S-04/S-15 both map onto this one `/profile` route; reconciling the screen inventory is doc 06's job (cross-ref only).
2. User enters **name** (text field) and picks **district** from the 36-district picker (`GET /meta/districts`, Marathi labels, searchable list — no typing needed beyond scroll/filter).
3. Optional: **taluka** (free text) and **village** (free text with Google Places autocomplete assist; if Places errors or exceeds 2 s the field silently behaves as plain text — PRD F-02 AC-3).
4. Role flags render as two pre-checked toggles — "मला जनावर विकायचे आहे" (I want to sell an animal) / "मला जनावर विकत घ्यायचे आहे" (I want to buy an animal). Both default `true` (BR-011); at least one must stay on.
5. Tap "जतन करा" (Save) → `POST /api/v1/users` with `firebaseUid`, `phone` (E.164 from Firebase), `name`, `districtId`, optional `taluka`/`village`, `languagePref` (from the S-01 choice, default `MR`). On success → `returnTo` (pending action auto-executes) or S-05.
6. **Returning users** land on **S-15** in one of two modes. **VIEW** (the default): a read-only card headed "माझी माहिती" with subtitle "तुमची नोंदणी पूर्ण झाली आहे." and rows नाव / मोबाईल नंबर (formatted `+91 XXXXX XXXXX`) / जिल्हा / तालुका / गाव (empty optionals render as "—"), plus a "माहिती बदला" (Change details) action. **EDIT** (opened from view): the same form pre-filled (header "माहिती बदला", subtitle "बदल करून जतन करा.") — "जतन करा" → `PATCH /api/v1/users/me` returns to VIEW with the updated values, "रद्द करा" cancels back to VIEW. The phone is shown read-only **only** in the VIEW card (row "मोबाईल नंबर") and is **not** rendered as a field in the EDIT form — immutability is enforced by field omission. UI reflects changes without re-login.
7. Language switching lives on **S-16** and is specified in [settings.md](settings.md); it persists via the same `PATCH /users/me` (`languagePref`).

### Account menu (AppMenu)

The hamburger **AppMenu** (top-right of the home header, `aria-label` "मेनू", opens the shared BottomSheet titled "मेनू") is the returning-user entry point to their profile. At the top sits an **account block**, sourced from `GET /users/me`:

- **Signed in** — an avatar plus the user's `name` (fallback "तुमचे खाते") and, on the second line, their own formatted phone `+91 XXXXX XXXXX` (fallback: district `nameMr`; "प्रोफाइल पूर्ण करा" when the profile row is missing/incomplete — the BR-013 completeness prompt). The own phone is only ever returned by `GET /users/me` (BR-066).
- **Signed out** — a "लॉगिन करा" button linking to `/login`.

The menu links to माझी प्रोफाइल (→ `/profile`, the view/edit screen above) and, when signed in, ends with a "बाहेर पडा" (Log out) action. **Cross-ref only:** logout semantics are owned by [auth.md](auth.md) step 8 and [settings.md](settings.md) step 7 — the AppMenu runs Firebase `signOut()` then routes home. The menu's other rows — the primary nav items, the `जाहिरात तपासणी` admin link shown when `isAdmin` (BR-012), and the feedback entry "अडचण कळवा / सूचना द्या" (WS5-B Feedback channel, works signed-out) — are owned by docs 06/10, the admin docs, and the Feedback feature doc respectively.

## Fields & validation

| Field | Type | Required | Validation rule | Error message EN | Error message MR |
|---|---|---|---|---|---|
| name | string | Yes | 2–50 characters after trimming; any script (Devanagari/Latin/mixed); must contain ≥ 2 letter characters (blocks digit-only/phone-number names); emoji stripped server-side | Enter your name (2–50 letters) | तुमचे नाव टाका (2–50 अक्षरे) |
| districtId | string (cuid) | Yes | Must be one of the 36 seeded Maharashtra districts | Choose your district | तुमचा जिल्हा निवडा |
| taluka | string | No | ≤ 60 characters | Taluka is too long | तालुक्याचे नाव खूप मोठे आहे |
| village | string | No at signup (required on listings, see [listing-create.md](listing-create.md)) | 2–60 characters when provided; free text; Places suggestion optional | Village name must be 2–60 letters | गावाचे नाव 2–60 अक्षरांत टाका |
| isFarmer / isBuyer | boolean ×2 | Yes | At least one of the two must be `true` | Choose at least one: sell or buy | विकणे किंवा विकत घेणे — किमान एक निवडा |
| languagePref | enum `MR\|EN` | Yes | Defaults `MR` (BR-010) | Choose a language | भाषा निवडा |
| phone | string | — | Read-only; from Firebase; E.164 | — (not editable) | — (बदलता येत नाही) |

All violations → 422 `VALIDATION_ERROR` with a per-field `details` map; the client renders inline errors (README §3.2).

## Business logic

- `POST /users` runs once per account; a duplicate attempt returns `USER_ALREADY_EXISTS` and the client recovers via `GET /users/me` — BR-010.
- Both role flags default `true`; they are informational for personalization/analytics and are **never** permission gates — BR-011. Downstream features must not branch permissions on them.
- Profile completeness (name + district) gates every authenticated write platform-wide (403 `PROFILE_INCOMPLETE`) but never gates browsing — BR-013, BR-060.
- Places suggestions outside Maharashtra are stored as typed free text; `district_id` (the filterable field) remains the seeded picker, so search integrity is unaffected (PRD F-02 edge case).
- Whitespace trimmed, emoji stripped server-side on `name`; digit-only names rejected (prevents phone-number leakage into public listing cards, feeding BR-066).
- The user's own phone is returned only by `GET /users/me`; no endpoint returns another user's phone outside the interest endpoint — BR-066.

## API usage

| Method + path | When |
|---|---|
| `GET /api/v1/meta/districts` | On S-04/S-15 open, to populate the district picker (cached client-side for the session) |
| `POST /api/v1/users` | Once, on S-04 save (first login) |
| `GET /api/v1/users/me` | After auth and on app start (see [auth.md](auth.md)); to pre-fill S-15 |
| `PATCH /api/v1/users/me` | On S-15 save (name, districtId, taluka, village, isFarmer, isBuyer, languagePref) |

## States

| State | What the user sees |
|---|---|
| Loading | District picker skeleton while `GET /meta/districts` loads; save button inline spinner during POST/PATCH. |
| Empty | S-04 first render: empty name field focused, district unset, toggles pre-checked, save disabled until name + district valid. A **returning** user's default render is instead the read-only "माझी माहिती" VIEW card, not this setup form. |
| Error | Inline field errors per table; network failure on save → toast "इंटरनेट नाही. पुन्हा प्रयत्न करा." with the form values retained and a retry action (README §3.3 — no background queue). |
| Success | S-04: routed to `returnTo` with the pending action auto-executed. S-15 edit: after "जतन करा" the screen returns to the read-only "माझी माहिती" card with the updated values, rather than staying in a form. |
| Edge | **Places API slow/down:** village silently degrades to plain text. **Both toggles switched off:** save blocked client-side and rejected server-side (`VALIDATION_ERROR`). **Killed before S-04 save:** no `users` row; next login re-enters S-04. **Incomplete profile deep-links to a write action:** 403 `PROFILE_INCOMPLETE` → S-04 with `returnTo` back to the action. |

## Analytics

| Event | Fired when | Properties |
|---|---|---|
| `signup_complete` | On successful `POST /users` (2xx) from S-04 | `districtId`, `languagePref` |

Profile edits fire no client event (server truth: `users.updated_at`).

## Acceptance criteria

1. Profile completion requires exactly two inputs — name (2–50 chars, ≥ 2 letters) and district (36-district Marathi-labelled picker); taluka and village are optional at signup.
2. `POST /users` creates the row with both role flags defaulting `true` and `languagePref` from the S-01 choice; a second POST for the same Firebase UID returns `USER_ALREADY_EXISTS` and the client recovers via `GET /users/me` without user-visible error.
3. Village autocomplete suggestions appear when Google Places responds within 2 s; on error/timeout the field accepts free text with no visible failure.
4. `PATCH /users/me` persists edits to name, district, taluka, village, role flags, and languagePref; the UI reflects them immediately without re-login.
5. The phone number renders read-only in the profile VIEW card (row "मोबाईल नंबर", formatted) and is **not** present as an editable field in the EDIT form; no UI path or API field allows changing it — immutability is enforced by field omission.
6. Turning both role flags off is blocked client-side and, if forced via API, rejected with 422 `VALIDATION_ERROR`.
7. A logged-in user with an incomplete profile can browse freely but is redirected to S-04 (with `returnTo`) when attempting listing creation, interest, favorite, or report — server enforced via 403 `PROFILE_INCOMPLETE`.
8. A name consisting only of digits or a phone-number pattern is rejected with the inline MR error "तुमचे नाव टाका (2–50 अक्षरे)".
9. A returning user opening `/profile` (`GET /users/me` 200) sees the read-only "माझी माहिती" card — not the create form; "माहिती बदला" opens the pre-filled edit form, "जतन करा" PATCHes and returns to the card with the updated values, and "रद्द करा" returns without saving.
10. When signed in, the home AppMenu account block shows the user's name and formatted phone from `GET /users/me` and a "बाहेर पडा" logout action; when signed out it shows a "लॉगिन करा" button; the block shows "प्रोफाइल पूर्ण करा" when the profile is incomplete.

## Out of scope

- Profile photo, bio, co-op/dairy affiliation — Phase 2 (PRD F-02 future improvements).
- Verified-seller badge — Phase 2; schema keeps an extension point only (foundation glossary).
- Phone-number change / account merge — not in MVP (one phone = one account, BR-010).
- Account deletion UI — helpline-mediated per BR-015; surfaced in [settings.md](settings.md).

## Acceptance checklist

- [x] All 12 mandatory sections of README §2 present in order, plus this checklist per foundation §7
- [x] Completeness gate matches BR-013 exactly (name + district; 403 `PROFILE_INCOMPLETE` on authenticated writes, never on browsing) with `returnTo` recovery via S-04
- [x] `POST /users` once-per-account semantics and `USER_ALREADY_EXISTS` recovery per BR-010; phone read-only from Firebase with the S-15 immutability copy
- [x] Role flags both default `true`, at least one required, and never used as permission gates per BR-011
- [x] Fields & validation table decision-complete with EN + Devanagari MR errors; 36-district picker; digit-only/phone-number names rejected (feeds BR-066); `languagePref` defaults `MR` per BR-010
- [x] Only canonical `/api/v1` endpoints referenced (`GET /meta/districts`, `POST /users`, `GET /users/me`, `PATCH /users/me`); screens cited as S-04/S-15 per doc 06 Flow A/D
- [x] All five states defined including the Places API degradation edge; analytics limited to the frozen `signup_complete` event
- [x] 8 testable acceptance criteria (≥ 6); no TBD; no contradiction with D1–D10 or docs 04/06/08
