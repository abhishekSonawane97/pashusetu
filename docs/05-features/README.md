# 05 — Feature Specifications

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 1.0 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-04 |
| **Depends on** | [../00-foundation/README.md](../00-foundation/README.md) · [../01-prd/README.md](../01-prd/README.md) · [../04-business-rules/README.md](../04-business-rules/README.md) · [../06-user-flows/README.md](../06-user-flows/README.md) |

> This folder holds the **build-level specification of every MVP feature** — one file per feature. Each file is decision-complete: a developer can implement the feature from that file plus the documents it links. Rules are **owned** by [../04-business-rules/README.md](../04-business-rules/README.md) (cited by `BR-xxx` id), screens by [../06-user-flows/README.md](../06-user-flows/README.md) (cited by `S-xx` id), API contracts by [../08-api/README.md](../08-api/README.md) (paths here match that canonical `/api/v1` surface exactly). If a feature file contradicts doc 04 or doc 00, the feature file is defective.

---

## 1. Feature index

Priorities are the PRD priorities ([../01-prd/README.md](../01-prd/README.md) §4). "Depends on" lists the features that must exist first for this one to function end-to-end.

| Feature | File | PRD id | Priority | Depends on |
|---|---|---|---|---|
| Phone-OTP authentication & session | [auth.md](auth.md) | F-01 | Must | — (Firebase project only) |
| User profile | [profile.md](profile.md) | F-02 | Must | F-01 |
| Create listing (5-step wizard) | [listing-create.md](listing-create.md) | F-03 | Must | F-01, F-02 |
| My Listings management | [listing-manage.md](listing-manage.md) | F-07 (+ edit rules of F-03) | Must | F-03 |
| Search & filters | [search-filters.md](search-filters.md) | F-04 | Must | seeded breeds/districts |
| Listing detail page | [listing-detail.md](listing-detail.md) | F-05 | Must | F-04 |
| Contact seller (call / WhatsApp / interest) | [contact-seller.md](contact-seller.md) | F-06 | Must | F-01, F-02, F-05 |
| Favorites | [favorites.md](favorites.md) | F-08 | Should | F-01, F-04, F-05 |
| Report listing | [reporting.md](reporting.md) | F-09 | Must | F-01, F-05, F-10 |
| Admin moderation panel | [admin-moderation.md](admin-moderation.md) | F-10 | Must | F-01, F-03 |
| Notifications (SMS + in-app) | [notifications.md](notifications.md) | F-11 | Should (in-app required for beta; SMS may land in final MVP sprint) | F-03, F-06, F-10 |
| Settings & language (i18n surface) | [settings.md](settings.md) | F-12 (+ profile-edit surface of F-02) | Must | F-01, F-02 |

Feature ↔ flow map: F-01/F-02 → Flow A + D · F-03 → Flow A · F-07 → Flow B · F-04 → Flow E · F-05/F-06/F-08 → Flow C · F-09 → Flow G · F-10 → Flow F + G · F-11 → cross-flow · F-12 → cross-flow. Flows are owned by [../06-user-flows/README.md](../06-user-flows/README.md).

---

## 2. Required structure of every feature file

Every file in this folder contains exactly these sections, in this order:

1. **Header table** — Status / Version / Owner / Last updated / Depends on (links to PRD F-id, doc 04 BR ids, doc 06 flow + screens).
2. **Purpose** — why the feature exists, in ≤ 5 lines.
3. **User stories** — the personas from [../03-users/README.md](../03-users/README.md).
4. **Preconditions & permissions** — who may use it, login requirement, role, profile-completeness requirement (BR-013).
5. **UX workflow** — numbered steps referencing `S-xx` screen ids.
6. **Fields & validation** — table: field / type / required / validation rule / error message EN / error message MR (Devanagari).
7. **Business logic** — bullet rules, each citing its owning `BR-xxx` id.
8. **API usage** — table of the exact canonical endpoints (method + path) and when each is called.
9. **States** — loading / empty / error / success / edge (see §3.1).
10. **Analytics** — events logged, drawn from the frozen NFR-10 list (see §3.4).
11. **Acceptance criteria** — numbered, testable, minimum 6.
12. **Out of scope** — what this feature deliberately does not do in MVP, with the Phase 2/3 pointer where one exists.
13. **Acceptance checklist** — final section per [../00-foundation/README.md](../00-foundation/README.md) §7: checkable boxes restating the file's own success parameters.

---

## 3. Shared conventions (binding for all 12 feature files)

### 3.1 States every feature must define

Every user-facing surface of every feature specifies all five states. A state a feature file does not mention does not exist — the designer and developer build only what is written.

| State | Definition | Default behavior unless the feature overrides it |
|---|---|---|
| **Loading** | Data or mutation in flight | Skeleton placeholders for lists/pages (never a blank screen or spinner-only screen, NFR-01); inline spinner inside the tapped button for mutations, button disabled while in flight |
| **Empty** | Zero items / nothing to show | Illustration + one-line Marathi copy + exactly one CTA that moves the user forward (dead-end audit, doc 06 §7) |
| **Error** | Request failed or validation failed | Per §3.2 display rules; retryable errors always render a retry affordance |
| **Success** | Action completed | Optimistic UI where specified; otherwise confirmation toast ≤ 3 s, auto-dismiss |
| **Edge** | Race conditions, stale data, limits hit | Named explicitly per feature with exact behavior and error code |

### 3.2 Error display rules

1. **Field validation errors** render inline, directly under the field, icon + text in the active language. The submit/next button stays enabled; tapping it scrolls to the first error.
2. **Action failures** (HTTP 409/422/429, transient 5xx) render as a toast/snackbar with the localized message; retryable failures include a "पुन्हा प्रयत्न करा" (Try again) action.
3. **Blocking states** render full-screen or as a sheet: `UNAUTHENTICATED` → login sheet with `returnTo` (doc 06 §3.2 login-wall behavior); `PROFILE_INCOMPLETE` → redirect to S-04; `USER_BANNED` → full-screen block with grievance contact **support@pashusetu.in** and helpline (BR-014, BR-055).
4. **Never show raw API error codes or the English `message`** to end users. The client maps `error.code` from the standard envelope `{ "error": { "code", "message", "details" } }` to an i18n key. Unknown/unmapped codes render the generic fallback: EN "Something went wrong. Please try again." / MR "काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा."
5. `RATE_LIMITED` responses carry `details.retryAfterSeconds`; the client shows the feature's specific limit copy (BR-090), never a countdown timer of the raw seconds value.
6. Admin screens (S-18…S-23) may show error codes verbatim — internal users, English-first UI (doc 06 §5.3).

### 3.3 Offline behavior (default for all features)

Per NFR-11 ([../01-prd/README.md](../01-prd/README.md)):

- **Reads**: app shell + previously visited listings + favorites render from the service-worker cache with the banner "इंटरनेट नाही — जुनी माहिती दाखवत आहोत" (No internet — showing older data).
- **Writes**: **offline queue-and-retry is OUT of scope for MVP.** No mutation is ever queued in the background. While offline, all write actions (create/edit listing, submit, favorite, interest, report, mark-sold, renew, archive, profile save) are disabled with the message "इंटरनेट नाही. पुन्हा प्रयत्न करा." (No internet. Try again.). A write that fails mid-flight shows an explicit **retry UI** (retry button on the failed item — e.g. per-photo retry on S-10c); the user re-triggers it manually. Draft autosave of the listing wizard persists locally-entered field values in memory/localStorage until connectivity allows the next `PATCH`, but the server write itself is never queued.
- A cold start with no network shows the branded offline page, never the browser error page.

### 3.4 Analytics — frozen event list

Client funnel events come **exclusively** from the frozen NFR-10 list (Vercel Web Analytics, cookie-free): `search_performed`, `filter_applied`, `listing_view`, `contact_call_tap`, `contact_whatsapp_tap`, `send_interest`, `favorite_add`, `report_submit`, `listing_create_start`, `listing_photo_added`, `listing_submit`, `signup_complete`, `language_switch`, `pwa_installed`. **No feature may invent additional client events in MVP** (protects the NFR-01 JS budget and keeps the funnel stable). Features without a frozen event measure themselves from Postgres product truth (`listings`, `interest_events`, `moderation_log`, `notifications`) via `GET /api/v1/admin/stats`. Each feature file states which events it fires and with which properties; payload serialization is formalized in [../09-backend/README.md](../09-backend/README.md). `pwa_installed` is an app-shell event (fired on the `appinstalled` browser event) owned by no single feature.

### 3.5 API, auth, pagination, i18n

- Every endpoint referenced is from the canonical `/api/v1` surface; full request/response contracts in [../08-api/README.md](../08-api/README.md). API JSON uses camelCase field names; the DB uses snake_case ([../07-database/README.md](../07-database/README.md)).
- Auth = `Authorization: Bearer <Firebase ID token>`, verified server-side with the Firebase Admin SDK. IDs are cuid strings, money is integer INR, timestamps are ISO 8601 UTC.
- All list endpoints are cursor-paginated: default 20, max 50, opaque `nextCursor` (BR-090 #12).
- Every user-facing string in these files exists in both `mr.json` and `en.json` catalogs (F-12); Marathi is the default. Strings written in doc 06 §6 are reused verbatim.
- Numbers render in Latin digits with Indian grouping (₹65,000) in both locales (PRD F-12 AC-6).

### 3.6 Marathi copy register

Simple, rural-friendly Devanagari: short sentences, everyday words (जनावर, not पशुधन), respectful तुम्ही forms, icon + text pairing on every primary action (NFR-07). Every MR string in these files carries an English gloss.

---

## Acceptance checklist

- [x] Index table lists all 12 features with file link, PRD F-id, priority (matching PRD §4 priorities), and dependency column
- [x] All 12 feature files exist in this folder and follow the §2 structure (header table, purpose, user stories, preconditions, S-xx workflow, fields & validation with EN+MR errors, BR-cited business logic, canonical API table, five states, analytics, ≥ 6 acceptance criteria, out-of-scope, acceptance checklist)
- [x] Shared conventions define the five mandatory states, error display rules (incl. error-envelope mapping and banned/blocked handling), and offline default: no write queue-and-retry in MVP — retry UI instead
- [x] Analytics restricted to the frozen NFR-10 event list; no invented client events
- [x] All endpoint references match the canonical `/api/v1` surface; pagination, auth, and error-envelope conventions restated once here and reused by all files
- [x] No contradiction with locked decisions D1–D10 or with [../04-business-rules/README.md](../04-business-rules/README.md); rules cited by BR-xxx id, screens by S-xx id
- [x] Marathi strings are real Devanagari with English gloss; register rule stated
- [x] No TBD/TODO/open questions; header table per foundation §7
