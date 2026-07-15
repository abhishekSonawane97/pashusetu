# PashuSetu — Implementation Status

**Date:** 2026-07-14
**Commit:** `@ a412149` (deployed prod HEAD = `origin/main`; the local `main` ref is stale at `d737176`)
**Coverage:** 96 documented items audited — 16 🚀 SHIPPED · 34 ✅ VERIFIED · 22 🟠 PARTIAL · 2 🟡 BUILT · 22 ⬜ NOT BUILT.

## Executive summary

The **create → approve → browse → contact** core loop is **live in production on pashusetu.online** (Vercel + Neon; Supabase S3-compatible storage) and exercised by real users: a logged-in seller creates a DRAFT through the 5-step wizard, uploads photos (presign → PUT → WebP variants), accepts the declaration and submits to PENDING; an admin approves or rejects it from the live queue (30-day expiry + moderation-log row) — the approve/reject leg, previously code-complete but runtime-unverified because mutating the shared DB was out of scope, **now runs against prod Neon**; the public browses and filters the APPROVED feed with keyset pagination; and a buyer logs in and taps CALL / WhatsApp / Send-Interest to reveal the seller's phone — which never leaks anywhere else on the page or API. Phone-OTP authentication (now on Fast2SMS in prod), per-request ban enforcement, and the OWASP security-header baseline are all verified. The **post-approval / community layer shipped this session**: real profile view/edit for returning users (GET/PATCH `/users/me`), POST lifecycle (resume DRAFT + edit via `/sell/new?id=` + mark-sold), Share on the detail page, expanded search/filters (breed / pregnancy / min-milk / age-range + free-text `q`), an admin analytics dashboard (`/admin/stats`), and a public feedback channel (FeedbackSheet + `/admin/feedback` inbox). Still **NOT built**: favorites, report-listing, notifications (SMS + in-app), the renew/archive lifecycle actions, admin ban / reports-queue / audit-log, and a runtime i18n language toggle. The authorization/ownership matrix stays **PARTIAL** — every route wires a guard and the ownership branches are unit-tested at the `assertOwnerVisible` helper level, but no ST-01 full-matrix or ST-04 IDOR suite has been run through live HTTP.

## Status legend

| Symbol | Meaning |
|---|---|
| 🚀 SHIPPED | Live in production on pashusetu.online (Vercel + Neon) and exercised by real users |
| ✅ VERIFIED | Behavior proven by a passing test and/or live check |
| 🟡 BUILT | Code wired and compiles, but no runtime/behavioral proof |
| 🟠 PARTIAL | Some sub-behaviors built and proven; others missing or unproven |
| ⬜ NOT BUILT | No implementation (scaffolding-only at most) |

## Verified working end-to-end

The **create → approve → browse → contact** legs are proven across the test tiers and now run in production; the **approve/reject** leg executes against prod Neon via the live admin queue:

- **Create + photos:** `listing-writepath.test.ts` T-01 creates a DRAFT with only species; the image-pipeline test runs a real `presign → PUT a real JPEG → attach → public WebP variant fetchable (image/webp 200)` against Supabase (S3-compatible) storage; T-02 submits a complete DRAFT with ≥3 photos + declaration to **PENDING** (`declarationAt` not null). BR-023 (min 3 photos), BR-024 (11th active listing → `LISTING_LIMIT_REACHED` 409), and the BR-022 conditional-field matrix all pass (16 integration + 125 unit tests).
- **Approve (🚀 SHIPPED):** `approveTransition` sets `status=APPROVED`, `expiresAt=now+30d`, and writes a `moderationLog` APPROVE row inside one transaction; approve/reject now execute on prod Neon via the live admin queue.
- **Browse + filter:** live `GET /api/v1/listings?limit=2` → 200 with opaque base64url `nextCursor`; `?species=HORSE` / `minPrice>maxPrice` / bad cursor / `limit=99` all → 400 `VALIDATION_ERROR`; `searchApproved` forces `status='APPROVED'` unconditionally with keyset pagination. `http-listings-detail` proves APPROVED → 200 with seller first-name only, DRAFT/unknown → 404.
- **Contact:** `interest-writepath.test.ts` proves CALL/WhatsApp/Interest each log one `interest_events` row then reveal the E.164 phone + server-built `wa.me` link in a single transaction; own listing → `FORBIDDEN/OWN_LISTING`, non-APPROVED → 404, 21st event/24h → `RATE_LIMITED` (no 21st row). Live `BR-066` phone scan of detail HTML + public API + sitemap returned **empty** — phone appears nowhere but the authenticated interest response.

## Features

| ID | Name | Status | Evidence | Gaps |
|---|---|---|---|---|
| F-01 | Phone-OTP auth & session management | 🚀 SHIPPED | Prod OTP runs on Fast2SMS ('quick' open-template route; Firebase-token path retained for dev/CI) and surfaces the Fast2SMS failure reason to the user; as implemented — 10-min code validity, 120s resend timer, 5 wrong-attempt cap (canonical values owned by 04; SMS provider/backend by 00/09). `verify-auth.test.ts` (401/403/404/USER_BANNED matrix); live anon APIs → 401; `client.ts` silent-refresh on 401; login banned-step + signOut | Prod Fast2SMS is DND-dropped for many numbers; `OTP_TEST_MODE` fixed code 246810 is dev/CI only; real Firebase-signed-token verify and banned full-screen UI have no dedicated behavioral test |
| F-03 | Animal listing CRUD with photos | 🚀 SHIPPED | Species set is 5 listable — COW/BUFFALO/BULL_OX/GOAT/SHEEP (गाय/म्हैस/बैल/शेळी/मेंढी) (REDA/रेडा retired — not listable); photo cap MIN 3 / MAX 10 with multi-select gallery upload; DRAFT resume (`/sell/new?id=`), edit of an existing listing, and mark-sold (APPROVED→SOLD) all live. 16 integration tests (writepath + image-pipeline): DRAFT→PENDING, BR-023/024, real WebP pipeline, PHOTO_LIMIT; live `/sell` 200, auth-gated writes 401. Species enum owned by 07, photo-count value by 04 | APPROVED non-price edit → PENDING and HEIC/oversize presign status code not directly asserted |
| F-04 | Search & filters | 🚀 SHIPPED | Home search filters in place (no `/listings` redirect); breed filter, pregnancy toggle, min-milk, age-range, and free-text `q` (village / breed mr+en / seller-name / listing-id) live; active-filter count badge + clear-all + sticky results header; nearby feed no longer swaps under the user; real empty states (near-you / no-listings / filtered). Live filter/sort/cursor probes → 200/400; `search-query`+`cursor` unit tests; `searchApproved` forces APPROVED + keyset. Filter query params owned by 08 | Client-fetches results (not true SSR from shared URL); scroll-restoration untested |
| F-06 | Contact seller (call/WhatsApp/interest) | 🚀 SHIPPED | WhatsApp opens via a real `<a wa.me>` link (no post-await `window.open`); per-listing reveal cache so re-taps don't re-POST (protects the 20/day interest cap); `interest-writepath.test.ts` (log+reveal, OWN_LISTING, RATE_LIMITED); BR-066 phone scan empty; ContactBar login-then-resume | INTEREST seller notification (BR-071) deferred; tel:/wa.me open + resume flow not covered by the new `browse.spec.ts` e2e |
| F-02 | User profile | 🚀 SHIPPED | Returning users get a real profile view + edit screen (name / district / taluka / village) backed by GET/PATCH `/users/me` on prod (view→edit mode; setup for new users); `users.test.ts` role/name/BR-011 rules; `http-users` POST create. Functional spec owned by 05, screen sequence by 06 | No role-flag toggles in the edit form; Places autocomplete assist still deferred; PATCH not HTTP-integration-tested |
| F-05 | Listing detail page | 🟠 PARTIAL | SSR detail page + `http-listings-detail` (200/404/no-phone); PhotoCarousel + ContactBar; Share action (Web Share + wa.me/facebook/telegram fallback + copy, no phone in payload) and related-animals shelf ('nearby, same district'); back control always returns home. Feature spec owned by 05 | No photo zoom; no favorite/report action; owner/admin status banner not wired (page always calls getDetail with null viewer); SOLD/expired render soft 200 not 404 |
| F-07 | My Listings management (lifecycle) | 🟠 PARTIAL | `getOwnListings` (status filter, quota meter) tested; terminal edit → 409; REJECTED reason shown; mark-sold (APPROVED→SOLD) and edit-existing-listing now shipped, with per-step validation + jump-to-step and a full step-5 read-back | renew and archive still have no implementation; no ARCHIVED tab; viewCount/interestCount not surfaced in UI |
| F-08 | Favorites | 🟠 PARTIAL | Prisma `Favorite` model (idempotent @@id) + read-only `isFavorited` flag | No save/unsave/list API, no `/favorites` page (404), no heart toggle — core feature unbuilt |
| F-09 | Report listing | 🟠 PARTIAL | Scaffolding only: Report model, ReportReason enum, REPORT_* error codes | No POST report route/service, no body schema, no auto-hide, no UI — reports slice (T-10) not landed |
| F-10 | Admin moderation panel | 🟠 PARTIAL | Admin 403 gate unit-tested; queue/approve/reject now run on prod; admin analytics dashboard (`/admin/stats`) and feedback inbox (`/admin/feedback`) shipped; admin nav has 3 tabs रांग / आकडेवारी / अभिप्राय | reports queue, ban/unban, and audit-log endpoints still absent |
| F-11 | Notifications (SMS + in-app) | 🟠 PARTIAL | Notification model + enums + decorative bell icon | No notification writes, no GET/POST routes, `/notifications` 404, no MSG91 SMS at all |
| F-12 | Marathi/English i18n + settings | 🟠 PARTIAL | `mr.json`/`en.json` parity test; API-error locale resolve; `lang="mr"` default; a settings/account surface now exists — AppMenu hamburger (logged-in user block + nav + LOGOUT + admin link when isAdmin + feedback entry) and real profile view/edit. i18n mechanics owned by 09/NFR-06 | next-intl unwired; UI strings hardcoded Devanagari; no language toggle/runtime switch |
| F-13 | Feedback channel (report a problem / suggestion) | 🚀 SHIPPED | Feedback model + FeedbackType/FeedbackStatus enums + migration `20260714095640_add_feedback`; public POST `/api/v1/feedback` (optionalAuth, anonymous allowed), admin GET + PATCH; FeedbackSheet from app menu ('अडचण कळवा / सूचना द्या', works signed-out) + `/admin/feedback` inbox (नवीन/पूर्ण/सर्व triage). Schema owned by 07, API contract by 08, UI by 10 | No SMS/notification on new feedback; no rate-limit on anonymous submit |

## API endpoints

| ID | Name | Status | Evidence | Gaps |
|---|---|---|---|---|
| API-01 | POST /users | ✅ VERIFIED | `http-users` 201 (phone from token, firebaseUid never returned), 401 anon, 409 duplicate | Duplicate returns generic CONFLICT not spec'd `USER_ALREADY_EXISTS` (P2002 adapter drift) |
| API-03 | PATCH /users/me | ✅ VERIFIED | `users.test.ts`: `.strict()` rejects phone/unknown; BR-011 on current pair → 422; verifyAuth blocks banned | No end-to-end HTTP 200 assertion (mutating; can't live-smoke) |
| API-04 | GET /meta/breeds | ✅ VERIFIED | Live 200; `?species=COW` filters; `?species=DRAGON` → 400; 24h cache-control header | — |
| API-05 | GET /meta/districts | ✅ VERIFIED | Live 200: 36 items sorted by nameEn, cache-control 24h | — |
| API-06 | GET /listings | ✅ VERIFIED | Live 200 with cursor envelope; `http-listings-validation`; limit ≤50 clamp | — |
| API-07 | GET /listings/{id} | ✅ VERIFIED | `http-listings-detail` (404 unknown/DRAFT, 200 no-phone); live 200 | view_count increment not asserted by a test |
| API-08 | POST /listings | ✅ VERIFIED | writepath T-01 DRAFT + BR-024 409; unit phone-in-text block | PHONE_IN_DESCRIPTION 422 asserted on submit path, not create |
| API-09 | PATCH /listings/{id} | ✅ VERIFIED | writepath: DRAFT patch + cross-field, terminal `EDIT_NOT_ALLOWED` 409 | APPROVED→PENDING/DECLARATION_REQUIRED edit branch not named-tested |
| API-10 | POST /listings/{id}/submit | ✅ VERIFIED | writepath: DECLARATION_REQUIRED, incomplete 422 map, T-02 DRAFT→PENDING | REJECTED→PENDING and 409 non-DRAFT branch not directly tested |
| API-14 | GET /users/me/listings | ✅ VERIFIED | `getOwnListings` test (activeLimit=10 meta); live 401 anon | Status-filter + cursor branches not directly tested |
| API-15 | POST /uploads/presign | ✅ VERIFIED | image-pipeline real PUT succeeds against Supabase (S3-compatible) storage on prod; `.strict()` schema. Storage/stack decision owned by 00/13 | Route wrapper not exercised (service called directly) |
| API-16 | POST /listings/{id}/images | ✅ VERIFIED | image-pipeline attach happy-path + PHOTO_LIMIT_EXCEEDED 409 | INVALID_UPLOAD 422 and T-09 APPROVED→PENDING branches not asserted |
| API-21 | POST /listings/{id}/interest | ✅ VERIFIED | `interest-writepath` (log+reveal, OWN_LISTING, RATE_LIMITED); live 401 | 201/429 mapping from source only; seller notification deferred |
| API-02 | GET /users/me | ✅ VERIFIED | Route wired (verifyToken → findMeByFirebaseUid → 404→S-04); live 401 anon; now serves the live profile view on prod | Live-on-prod, no dedicated automated regression test (200-with-phone / 404-no-profile / 200-for-BANNED) |
| API-25 | GET /admin/listings | ✅ VERIFIED | requireAdmin → listQueue; FIFO oldest-first repo; live 401 anon; drives the live admin queue on prod | Live-on-prod, no dedicated automated regression test for ordering/pagination/metadata |
| API-26 | POST /admin/listings/{id}/approve | ✅ VERIFIED | approveTransition: →APPROVED, +30d expiry, APPROVE log, 409 sub-reasons; now executes against prod Neon via the live admin queue | Live-on-prod, no dedicated automated regression test |
| API-27 | POST /admin/listings/{id}/reject | ✅ VERIFIED | rejectTransition: →REJECTED + verbatim reason + REJECT log; OTHER-detail rule; now executes against prod Neon via the live admin queue | Live-on-prod, no dedicated automated regression test |
| API-17 | DELETE /listings/{id}/images/{imageId} | 🟠 PARTIAL | Route returns 204; LAST_IMAGE 409; T-09 on APPROVED | No sortOrder compaction; no declarationAccepted query gate; untested |
| API-11 | POST /listings/{id}/sold | 🚀 SHIPPED | Owner-only POST performs the APPROVED→SOLD transition on prod (no body); any other state → INVALID_STATE_TRANSITION. Contract owned by 08 | — |
| API-12 | POST /listings/{id}/renew | ⬜ NOT BUILT | No route; only a code comment mentions renew | Entire endpoint missing |
| API-13 | POST /listings/{id}/archive | ⬜ NOT BUILT | No route; ARCHIVED only a terminal guard | Entire endpoint missing |
| API-18 | GET /users/me/favorites | ⬜ NOT BUILT | No route; only forward-ref comments; `/favorites` 404 | Entire endpoint missing |
| API-19 | POST /users/me/favorites | ⬜ NOT BUILT | No route; only Favorite model + read helper | Entire endpoint missing |
| API-20 | DELETE /users/me/favorites/{listingId} | ⬜ NOT BUILT | No route; only read helper + unused error scaffolding | Entire endpoint missing |
| API-22 | POST /listings/{id}/report | ⬜ NOT BUILT | No route; only Report model + enum + error codes | Entire endpoint missing |
| API-23 | GET /users/me/notifications | ⬜ NOT BUILT | No route; zero notifications code in app/api | Entire endpoint missing |
| API-24 | POST /notifications/{id}/read | ⬜ NOT BUILT | No notifications directory at all | Entire endpoint missing |
| API-28 | GET /admin/reports | ⬜ NOT BUILT | admin/ has only listings/ | Entire endpoint missing |
| API-29 | POST /admin/reports/{id}/resolve | ⬜ NOT BUILT | No reports route anywhere | Entire endpoint missing |
| API-30 | POST /admin/reports/{id}/dismiss | ⬜ NOT BUILT | Only DISMISS_REPORT enum value exists | Entire endpoint missing |
| API-31 | POST /admin/users/{id}/ban | ⬜ NOT BUILT | No admin/users subtree; BANNED only read-side | Entire endpoint missing |
| API-32 | POST /admin/users/{id}/unban | ⬜ NOT BUILT | No admin/users subtree | Entire endpoint missing |
| API-33 | GET /admin/audit-log | ⬜ NOT BUILT | moderation_log is write-only; no read route | Entire endpoint missing |
| API-34 | GET /admin/stats | 🚀 SHIPPED | `requireAdmin`; returns read-only aggregates — listings by status + total, new today/week, approved viewCount sum + top-5 viewed, interest events by type all-time + last-7d, zero-enquiry approved count, top-5 districts; no schema change. Contract owned by 08 | — |
| API-35 | POST /feedback | 🚀 SHIPPED | Public, `optionalAuth` → userId set only when logged in; anonymous allowed; NOT subject to BR-065/BR-066 no-phone rule. Contract owned by 08; no-phone exemption is a rule owned by 04 | — |
| API-36 | GET /admin/feedback | 🚀 SHIPPED | `requireAdmin`; lists feedback for the inbox (optional status filter + NEW count). Contract owned by 08 | — |
| API-37 | PATCH /admin/feedback/{id} | 🚀 SHIPPED | `requireAdmin`; status triage NEW→SEEN→DONE. Contract owned by 08 | — |

## Screens

| ID | Name | Status | Evidence | Gaps |
|---|---|---|---|---|
| S-02 | Phone entry — /login (step 1) | ✅ VERIFIED | Live `/login` 200 renders phone step; `otp-helpers.test.ts` isValidPhone/toE164 | Firebase OTP send not test-exercised; login-wall is full-route redirect, not in-place sheet |
| S-03 | OTP verify — /login (step 2) | ✅ VERIFIED | 6-digit input + 120s resend timer / 5-attempt lockout / 10-min validity window unit-tested (`otp-helpers.test.ts`); live 200. Canonical values owned by 04 | Firebase confirm() + post-auth routing Firebase-dependent, untested |
| S-05 | Home / browse — / | ✅ VERIFIED | Live / 200 (brand header, species chips, feed); hero reduced 70vh→50vh with a 'view detail' CTA; home filter bar sticky (top:0); home search opens/filters in place (no `/listings` redirect); real empty states; `/api/v1/listings` 200. Design/component details owned by 10, flow by 06 | — |
| S-06 | Search results + filters — /listings | ✅ VERIFIED | Live 200 + filter button; species-filtered cursor envelope; `http-listings-validation`; breed filter now in the sheet, plus pregnancy toggle, min-milk, age-range, free-text `q`, active-filter badge, clear-all, sticky results header | Multi-page infinite scroll untested |
| S-07 | Listing detail — /listings/[id] | ✅ VERIFIED | Live SSR 200, zero phone in HTML; `http-listings-detail` 200/404; notFound/sold banners; Share action, related-animals shelf, and back-control-always-returns-home (no deep-link strand) | — |
| S-10 | Create wizard host — /sell/new | ✅ VERIFIED | Live 200; 5-step progress shell; autosave POST/PATCH + submit; BR-024 API tested | Client orchestration not E2E-tested; no labeled save-and-exit |
| S-10a | Wizard step 1: species & breed | ✅ VERIFIED | 5-species array (REDA/रेडा retired — not listable); live `/meta/breeds?species=COW` 200 (11 breeds); species change refetch. Canonical enum owned by 07 | Rendered as text pills, not spec'd icon grid |
| S-10b | Wizard step 2: animal details | ✅ VERIFIED | BR-022 conditional field set; `listings-validation.test.ts` matrix passes | Age captured as months only (no years input); no DOM E2E |
| S-10c | Wizard step 3: photos | ✅ VERIFIED | PhotoUploader presign→PUT→attach; image-pipeline tests; ≥3 gate (MIN 3), MAX 10; multi-select gallery upload (dropped forced camera capture). Photo-cap owned by 04 | No reorder UI; single global spinner (no per-photo progress) |
| S-10d | Wizard step 4: price & location | ✅ VERIFIED | Live `?step=4` 200; taluka-compulsory-at-submit unit-tested; districts API | District not prefilled from profile |
| S-10e | Wizard step 5: declaration & review | ✅ VERIFIED | Declaration string verbatim-matches canonical; submit disabled until checked; T-02 test | Step-5 UI source-verified only (auth-gated SPA) |
| S-18 | Admin: login & guard — /admin | ✅ VERIFIED | AdminGate redirect + isAdmin check; requireAdmin per-request; admin nav now has 3 tabs रांग (queue) / आकडेवारी (stats) / अभिप्राय (feedback); live /admin 200, admin API 401; robots Disallow. is_admin is set only via `scripts/grant-admin.ts` or SQL — no UI/API (BR-012, owned by 04) | Authenticated non-admin (403) path not test-distinguished from anon |
| S-19 | Admin: pending queue — /admin | ✅ VERIFIED | Queue renders under a real admin session on prod; SLA/soft-flag badges; FIFO repo; API 401 anon | Auto-hide not implemented |
| S-04 | Profile setup — /profile | 🟠 PARTIAL | Client setup form (name/district/village) → POST /users; live 200 | Route is /profile not /profile/setup; no role-flag toggles; Places deferred; form not E2E-tested |
| S-08 | Photo viewer overlay | 🟠 PARTIAL | Inline PhotoCarousel (swipe + dots) on detail page | No full-screen pinch-zoom overlay with counter/close — S-08 component absent |
| S-09 | Seller public profile snippet | 🟠 PARTIAL | Inline SSR seller card (firstName, memberSince, activeListingCount, no phone) | Not a tappable bottom-sheet overlay; shows district only (not village) |
| S-11 | My listings — /sell | 🟠 PARTIAL | Quota meter + status tabs + StatusBadge (7 statuses); live 200; per-card mark-sold action and resume-draft/edit now shipped | No Archived tab; no per-card renew action; only AuthGate shell proven anon |
| S-15 | Profile / settings — /profile | 🟠 PARTIAL | GET/PATCH /users/me routes wired; live 401 API; profile view/edit now shipped and LOGOUT now present (via AppMenu hamburger, top-right of the home header) | No language toggle, no T&C, no delete-account rows |
| S-20 | Admin: listing review detail — inline in /admin | 🟠 PARTIAL | Inline review cards (attributes/photos/seller history); approve/reject + mandatory reason; moderation_log in txn | No dedicated /admin/listings/[id] route; declarationAt not rendered; mutations untested |
| S-01 | Splash & language pick — /welcome | ⬜ NOT BUILT | No /welcome route; root → browse landing | No splash, no मराठी/English picker, language fixed at build time |
| S-12 | Edit listing — /sell/new?id= | 🚀 SHIPPED | Edit ships via `/sell/new?id=` (resume/edit/jump-to-step + full step-5 read-back), not a dedicated `/sell/[id]/edit` route; pre-filled wizard for an existing listing incl. REJECTED resubmit. Route divergence from the original S-12 spec (owned by 06) | — |
| S-13 | Favorites — /favorites | ⬜ NOT BUILT | Live 404; only dead BottomNav link | Entire screen + API missing |
| S-14 | Notifications — /notifications | ⬜ NOT BUILT | Bell links to non-existent route; deferred TODOs | Entire screen + API missing |
| S-16 | Language settings — /profile/language | ⬜ NOT BUILT | No route; only backend languagePref persistence | No toggle UI, no i18n layer |
| S-17 | Report listing modal | ⬜ NOT BUILT | No component/route; only unused reason enum | Entire flow missing |
| S-21 | Admin: reports queue — /admin/reports | ⬜ NOT BUILT | No route/page/API; only openReportCount badge | Entire screen missing |
| S-22 | Admin: users & ban — /admin/users | ⬜ NOT BUILT | No route/API; ban is read-side only | Entire screen missing |
| S-23 | Admin: stats dashboard — /admin/stats | 🚀 SHIPPED | Admin-only aggregates dashboard, read-only, no schema change; screen sequence owned by 06, components by 10 | — |
| S-24 | Admin: feedback inbox — /admin/feedback | 🚀 SHIPPED | Tabs नवीन/पूर्ण/सर्व with 'पूर्ण झाले' triage; PATCH status | — |
| S-25 | Feedback sheet (FeedbackSheet) — from app menu | 🚀 SHIPPED | 'अडचण कळवा / सूचना द्या', works signed-out, POST /feedback | — |
| S-26 | Branded Marathi 404 (app/not-found.tsx) | 🚀 SHIPPED | Marathi not-found page; back returns home | — |

## NFRs

| ID | Name | Status | Evidence | Gaps |
|---|---|---|---|---|
| NFR-08 | Security posture, auth & OWASP baseline | ✅ VERIFIED | Single verifyIdToken path; `verify-auth.test.ts`; live headers (CSP/HSTS/X-Frame DENY/nosniff); `.strict()` mass-assignment guard; no prohibited PII in schema | Per-route banned-403 only unit-tested; OWASP pre-beta review is a process item |
| NFR-12 | Capacity — MVP scale ceiling | ✅ VERIFIED | limit≤50 clamp unit-tested; keyset (no OFFSET); composite indexes cover every filter; write-limiter is one upsert; scale triggers documented; live 200 | Ceiling itself not load-tested (no benchmark/EXPLAIN at target volume) |
| NFR-09 | SEO discoverability & link previews | ✅ VERIFIED | Live detail HTML: `canonical` + `hrefLang mr-IN`/`x-default` + `og:image`=card variant + `og:title` + `twitter:card=summary_large_image`; Product/Offer/Organization/WebSite JSON-LD; home Org+WebSite JSON-LD; `/sitemap.xml` + `/robots.txt` (env-gated) + `/og-default.png` all live 200 | `en-IN` hreflang pair pending real English routing; no external rich-results/Search-Console validation run |
| BR-066 | Seller-phone concealment (privacy) | ✅ VERIFIED | Live phone scan of detail HTML + public listing API + `/sitemap.xml` returned EMPTY; repo detail select omits `User.phone` (admin-only exception); `interest-writepath` proves the phone appears ONLY in the authenticated interest response | — |
| NFR-03 | API p95 latency | 🟡 BUILT | Keyset cursors + listings_search_idx + findUnique detail; live endpoints 200 | No load test / p95 timing captured; targets unmeasured |
| NFR-07 | Accessibility (WCAG-informed) | 🟡 BUILT | 18px base, 48px touch-min tokens applied; icon+label rule; alt text | @axe-core in deps but never run; no contrast/tap-target/font-scale machine check |
| NFR-01 | Performance / JS budget on 3G | 🟠 PARTIAL | lighthouserc.cjs (Fast-3G) + .size-limit.json + SSR + next/image lazy-load | No LHCI/size-limit run captured; budgets looser than and not matching spec split |
| NFR-02 | Image & Devanagari webfont byte budgets | 🟠 PARTIAL | 3 WebP variants (sharp, EXIF-stripped); self-hosted Noto via next/font | No byte-budget enforcement/test; q80 not q70, detail 1600px not 1280px; font ~121KB (>60KB) |
| NFR-04 | Availability & zero-downtime deploys | 🟠 PARTIAL | 3 kill switches (503+retry-after) in middleware; health probe 200; prod migrate→promote sequence now executed (`prisma migrate deploy` with DIRECT_URL applied MANUALLY to prod Neon before the code push). Canonical deployment procedure owned by 13 | No committed uptime monitor; kill-switch 503 untested |
| NFR-06 | i18n quality — Marathi-first, 100% coverage | 🟠 PARTIAL | `lang="mr"` default; parity test (99 identical keys); bilingual seed data | 25 UI files hardcode Devanagari; next-intl unwired; catalog only backs API errors |
| NFR-08-AUTHZ | Authorization matrix (deny-by-default) | 🟠 PARTIAL | Full guard set + assertOwnerVisible branches unit-tested; every route wires a guard; masking in http tests | No ST-01 full-matrix or ST-04 IDOR suite through live HTTP; non-owner mutation only helper-level proven |
| BR-090 | Rate limiting (Postgres rolling-window) | 🟠 PARTIAL | 20 interests/day integration-passed; AppError.rateLimited 429 | 60 writes/min limiter is dead code + no rate_limits table; 5 reports/day unbuilt; no parallel-race test |
| NFR-10 | Analytics & instrumentation | 🟠 PARTIAL | admin `/admin/stats` aggregation now shipped (read-only aggregates over view_count / interest_events / moderation_log) | No @vercel/analytics; 0 of 14 frozen events emitted |
| NFR-11 | PWA installability & offline shell | 🟠 PARTIAL | manifest + icons + sw.js + /offline all live 200; SWR image cache; 2nd-session install gate | No offline write-guard; precache omits fonts/catalogs; no installability/airplane-mode audit |
| NFR-05 | Stability, error budget & Sentry | ⬜ NOT BUILT | Only console.error stub + CSP allowlist entry | No Sentry SDK/init, no PII scrubber, no crash-free tracking, no alert rules |

## Not yet built / known gaps

> **Shipped this session (no longer gaps):** the 🚀 SHIPPED items — POST lifecycle (mark-sold via `POST /listings/{id}/sold` + edit via `/sell/new?id=`), Share, expanded search/filters, admin `/admin/stats`, and WS5-B feedback (F-13, API-35/36/37, S-24/S-25) — are live on prod and removed from the lists below.

**NOT BUILT (no implementation):**

- **API-12 / API-13** — renew, archive endpoints: no routes, no EXPIRED→APPROVED / →ARCHIVED transitions.
- **API-18 / API-19 / API-20** — favorites list/save/unsave: no routes; only the Prisma model and a read-only `isFavorited` helper.
- **API-22** — report listing: no POST route/service; only model, enum, and error codes.
- **API-23 / API-24** — notifications list + mark-read: no routes, no notification code at all.
- **API-28 / API-29 / API-30** — admin reports queue/resolve/dismiss: entirely absent.
- **API-31 / API-32** — admin ban/unban: no admin/users subtree; BANNED is read-side enforcement only.
- **API-33** — admin audit-log: moderation_log is write-only; no read route.
- **S-01** — splash & language pick (/welcome): no route, no picker; language fixed at build time.
- **S-13** — favorites screen (404); **S-14** — notifications screen (bell link dead); **S-16** — language settings; **S-17** — report modal.
- **S-21 / S-22** — admin reports queue, users & ban.
- **NFR-05** — Sentry / error-budget monitoring: only a console.error stub and a CSP allowlist entry.

**PARTIAL (built but incomplete/unproven):**

- **F-05** — no photo zoom; favorite/report actions absent; owner/admin status banner not wired (page always renders as anonymous); SOLD/expired render soft 200 instead of 404 (Share + related shelf now shipped).
- **F-07** — renew and archive actions have no implementation; no ARCHIVED tab; viewCount/interestCount not surfaced (mark-sold + edit now shipped).
- **F-08** — favorites core unbuilt (no save/unsave/list API, no `/favorites` page, no heart toggle).
- **F-09** — reporting unbuilt beyond data/enum/error scaffolding (reports slice T-10 not landed).
- **F-10** — admin reports queue, ban/unban, and audit-log endpoints absent (stats + feedback inbox now shipped; approve/reject/queue live on prod).
- **F-11** — notifications: only data model + decorative bell; no writes, no routes, no MSG91 SMS.
- **F-12** — next-intl unwired; UI strings hardcoded Devanagari; no language toggle/runtime switch (AppMenu logout + profile view/edit now shipped).
- **API-17** — image delete: no sortOrder compaction, no declarationAccepted gate, endpoint untested.
- **S-04** — route is /profile not /profile/setup; no role-flag toggles; Places deferred; form not E2E-tested.
- **S-08** — only inline swipe+dots carousel; no full-screen pinch-zoom overlay with counter.
- **S-09** — seller snippet is an inline card, not a tappable bottom-sheet overlay; shows district only.
- **S-11** — no Archived tab; no per-card renew action; only AuthGate shell proven anon (mark-sold + resume/edit now shipped).
- **S-15** — no language toggle, T&C, or delete-account rows (profile view/edit + logout now shipped).
- **S-20** — no dedicated /admin/listings/[id] route (inline cards); declarationAt not rendered; mutations untested.
- **NFR-01** — no LHCI/size-limit run captured; configured budgets looser than and not matching the spec split.
- **NFR-02** — no byte-budget enforcement/test; encoding deviates (q80 vs q70, 1600px vs 1280px); Devanagari font ~121KB vs ≤60KB budget.
- **NFR-04** — no committed uptime monitor; kill-switch 503 output untested (prod migrate→promote sequence now executed).
- **NFR-06** — 25 UI files hardcode Devanagari; catalog only backs API error strings; parity test does not prove UI string coverage.
- **NFR-08-AUTHZ** — no ST-01 full-matrix or ST-04 IDOR suite through live HTTP; non-owner mutation proven only at helper level.
- **BR-090** — only the 20-interests/day cap is live+verified; the 60-writes/min limiter is unintegrated dead code with no `rate_limits` table; 5-reports/day unbuilt; no parallel-race test.
- **NFR-10** — no @vercel/analytics; 0 of 14 frozen events emitted (/admin/stats aggregation now shipped).
- **NFR-11** — no offline write-guard; SW precache omits fonts/catalogs; no installability/airplane-mode audit.

**BUILT (unverified — code complete, no runtime proof):**

- **NFR-03** API p95 latency — query design verified, but no timing measured.
- **NFR-07** accessibility — tokens/components in place, but no automated axe run or machine check.

## Verification method

- **typecheck:** `tsc --noEmit` clean (exit 0) — re-run this pass.
- **unit:** `vitest run tests/unit` → **141 passed, 3 failed (19 files)** — re-run this pass. The 3 failures are stale assertions lagging this session's changes (OTP 60s→120s resend timer, the species count — now 5 listable, REDA/रेडा retired (dormant enum value kept only for archived rows), and the expanded search-query schema); they are test-side, not product regressions, and belong to the QA/testing branch.
- **build:** `next build` clean, **41 route entries registered** (24 dynamic `/api/v1` + 17 page/asset routes), incl. the new `/api/v1/listings/[id]/sold`, `/api/v1/feedback`, `/api/v1/admin/stats`, `/api/v1/admin/feedback[/id]`, and `/api/v1/meta/talukas` — re-run this pass.
- **integration (authored, live Neon + Supabase S3-compatible storage, `RUN_DB_TESTS=1`):** `listing-writepath` + `image-pipeline` + `interest-writepath` (DB-gated; not re-run this pass).
- **integration (HTTP layer, live Neon):** `http-listings-detail` + `http-listings-validation` + `http-users` + `http-otp` (DB-gated; not re-run this pass).
- **e2e (Playwright — `tests/e2e/browse.spec.ts`):** home renders Marathi-first under an English browser locale, seller phone never appears in public HTML (BR-066), search results load with no login prompt.
- **new authored test scaffolding this session:** `tests/unit/api-messages.test.ts`, `tests/factories/`, `tests/support/`.
- **live smoke — dev server + prod (pashusetu.online):** public pages, PWA/SEO assets, and the API surface checked for status codes; auth-gated APIs return **401** anon; **BR-066 phone scan** of detail HTML + public API + sitemap returned **EMPTY** (no phone leak).
- **OTP:** `OTP_TEST_MODE` fixed code 246810 is dev/CI only; prod Fast2SMS 'quick' route is DND-dropped for many numbers.
- **known gap surfaced live:** `GET /favorites` → **404**.

> Status discipline: no item is rated above its verified verdict. Every ✅ row cites a concrete passing test or live check; 🟡 items are code-complete but lack runtime proof; 🟠 items have at least one built-and-proven sub-behavior alongside missing or unproven pieces; ⬜ items have no implementation beyond scaffolding.