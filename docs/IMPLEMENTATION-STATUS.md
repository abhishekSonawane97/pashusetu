# PashuSetu — Implementation Status

**Date:** 2026-07-11
**Commit:** `@ 0919809`
**Coverage:** 89 documented items audited — 33 ✅ VERIFIED · 23 🟠 PARTIAL · 7 🟡 BUILT · 26 ⬜ NOT BUILT.

## Executive summary

The seller-to-buyer core loop is code-complete end-to-end, and every leg except admin approval is proven at runtime: a logged-in seller creates a DRAFT listing through the 5-step wizard, uploads photos (presign → PUT → WebP variants), accepts the declaration and submits to PENDING; an admin can then approve it (30-day expiry + moderation-log row) — this approve leg is code-complete but runtime-unverified (mutating admin actions against the shared DB were out of scope); the public browses and filters the APPROVED feed with keyset pagination; and a buyer logs in and taps CALL / WhatsApp / Send-Interest to reveal the seller's phone — which never leaks anywhere else on the page or API. Phone-OTP authentication, per-request ban enforcement, and the OWASP security-header baseline are all verified. The authorization/ownership matrix is **PARTIAL** — every route wires a guard and the ownership branches are unit-tested at the `assertOwnerVisible` helper level, but no ST-01 full-matrix or ST-04 IDOR suite has been run through live HTTP. What is **not** built is the entire post-approval and community layer: favorites, reporting, notifications (SMS + in-app), the mark-sold/renew/archive lifecycle actions, most of the admin panel beyond the approve/reject queue, a runtime i18n toggle, and the settings surface. Several built pieces (admin approve/reject/queue, GET /users/me) are code-complete but lack a runtime test because mutating an admin action against the shared DB was out of scope.

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ VERIFIED | Behavior proven by a passing test and/or live check |
| 🟡 BUILT | Code wired and compiles, but no runtime/behavioral proof |
| 🟠 PARTIAL | Some sub-behaviors built and proven; others missing or unproven |
| ⬜ NOT BUILT | No implementation (scaffolding-only at most) |

## Verified working end-to-end

The **create → browse → contact** legs are proven across the test tiers; the **approve** leg is code-complete but runtime-unverified:

- **Create + photos:** `listing-writepath.test.ts` T-01 creates a DRAFT with only species; the image-pipeline test runs a real `presign → PUT a real JPEG → attach → public WebP variant fetchable (image/webp 200)` against live MinIO; T-02 submits a complete DRAFT with ≥3 photos + declaration to **PENDING** (`declarationAt` not null). BR-023 (min 3 photos), BR-024 (11th active listing → `LISTING_LIMIT_REACHED` 409), and the BR-022 conditional-field matrix all pass (16 integration + 125 unit tests).
- **Approve:** `approveTransition` sets `status=APPROVED`, `expiresAt=now+30d`, and writes a `moderationLog` APPROVE row inside one transaction (code-verified; runtime approve is 🟡 BUILT — no runtime/live proof, see gaps).
- **Browse + filter:** live `GET /api/v1/listings?limit=2` → 200 with opaque base64url `nextCursor`; `?species=HORSE` / `minPrice>maxPrice` / bad cursor / `limit=99` all → 400 `VALIDATION_ERROR`; `searchApproved` forces `status='APPROVED'` unconditionally with keyset pagination. `http-listings-detail` proves APPROVED → 200 with seller first-name only, DRAFT/unknown → 404.
- **Contact:** `interest-writepath.test.ts` proves CALL/WhatsApp/Interest each log one `interest_events` row then reveal the E.164 phone + server-built `wa.me` link in a single transaction; own listing → `FORBIDDEN/OWN_LISTING`, non-APPROVED → 404, 21st event/24h → `RATE_LIMITED` (no 21st row). Live `BR-066` phone scan of detail HTML + public API + sitemap returned **empty** — phone appears nowhere but the authenticated interest response.

## Features

| ID | Name | Status | Evidence | Gaps |
|---|---|---|---|---|
| F-01 | Phone-OTP auth & session management | ✅ VERIFIED | `verify-auth.test.ts` (401/403/404/USER_BANNED matrix); live anon APIs → 401; `client.ts` silent-refresh on 401; login page banned-step + signOut | Real Firebase-signed-token verify and banned full-screen UI / silent-refresh have no dedicated behavioral test (mocked/test-token only) |
| F-03 | Animal listing CRUD with photos | ✅ VERIFIED | 16 integration tests (writepath + image-pipeline): DRAFT→PENDING, BR-023/024, real WebP pipeline, PHOTO_LIMIT; live `/sell` 200, auth-gated writes 401 | APPROVED non-price edit → PENDING and HEIC/oversize presign status code not directly asserted |
| F-04 | Search & filters | ✅ VERIFIED | Live filter/sort/cursor probes → 200/400; `search-query`+`cursor` unit tests; `searchApproved` forces APPROVED + keyset | Client-fetches results (not true SSR from shared URL); scroll-restoration untested |
| F-06 | Contact seller (call/WhatsApp/interest) | ✅ VERIFIED | `interest-writepath.test.ts` (log+reveal, OWN_LISTING, RATE_LIMITED); BR-066 phone scan empty; ContactBar login-then-resume | INTEREST seller notification (BR-071) deferred; tel:/wa.me open + resume flow not headless-tested |
| F-02 | User profile | 🟠 PARTIAL | `users.test.ts` role/name/BR-011 rules; `http-users` POST create; PATCH route wired | Profile UI is create-only — no edit UI for taluka/language/role-flags, no Places assist, no client PATCH screen; PATCH not HTTP-integration-tested |
| F-05 | Listing detail page | 🟠 PARTIAL | SSR detail page + `http-listings-detail` (200/404/no-phone); PhotoCarousel + ContactBar | No zoom; no favorite/report/share actions; owner/admin status banner not wired (page always calls getDetail with null viewer); SOLD/expired render soft 200 not 404 |
| F-07 | My Listings management (lifecycle) | 🟠 PARTIAL | `getOwnListings` (status filter, quota meter) tested; terminal edit → 409; REJECTED reason shown | mark-sold / renew / archive have NO implementation; no ARCHIVED tab; viewCount/interestCount not surfaced in UI |
| F-08 | Favorites | 🟠 PARTIAL | Prisma `Favorite` model (idempotent @@id) + read-only `isFavorited` flag | No save/unsave/list API, no `/favorites` page (404), no heart toggle — core feature unbuilt |
| F-09 | Report listing | 🟠 PARTIAL | Scaffolding only: Report model, ReportReason enum, REPORT_* error codes | No POST report route/service, no body schema, no auto-hide, no UI — reports slice (T-10) not landed |
| F-10 | Admin moderation panel | 🟠 PARTIAL | Admin 403 gate unit-tested; queue/approve/reject routes + reject schema built; live `/admin` 200, admin API 401 | reports/ban/audit-log/stats endpoints entirely absent; approve/reject/queue have no runtime test |
| F-11 | Notifications (SMS + in-app) | 🟠 PARTIAL | Notification model + enums + decorative bell icon | No notification writes, no GET/POST routes, `/notifications` 404, no MSG91 SMS at all |
| F-12 | Marathi/English i18n + settings | 🟠 PARTIAL | `mr.json`/`en.json` parity test; API-error locale resolve; `lang="mr"` default | next-intl not installed; UI strings hardcoded Devanagari; no language toggle/runtime switch; no settings screen |

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
| API-15 | POST /uploads/presign | ✅ VERIFIED | image-pipeline real PUT succeeds against MinIO; `.strict()` schema | Route wrapper not exercised (service called directly) |
| API-16 | POST /listings/{id}/images | ✅ VERIFIED | image-pipeline attach happy-path + PHOTO_LIMIT_EXCEEDED 409 | INVALID_UPLOAD 422 and T-09 APPROVED→PENDING branches not asserted |
| API-21 | POST /listings/{id}/interest | ✅ VERIFIED | `interest-writepath` (log+reveal, OWN_LISTING, RATE_LIMITED); live 401 | 201/429 mapping from source only; seller notification deferred |
| API-02 | GET /users/me | 🟡 BUILT | Route wired (verifyToken → findMeByFirebaseUid → 404→S-04); live 401 anon | No test proves 200-with-phone, 404-no-profile, or 200-for-BANNED |
| API-25 | GET /admin/listings | 🟡 BUILT | requireAdmin → listQueue; FIFO oldest-first repo; live 401 anon | Success-path ordering/pagination/metadata unproven (no admin auth check) |
| API-26 | POST /admin/listings/{id}/approve | 🟡 BUILT | approveTransition: →APPROVED, +30d expiry, APPROVE log, 409 sub-reasons | No test/live exercises the transition (mutating, forbidden here) |
| API-27 | POST /admin/listings/{id}/reject | 🟡 BUILT | rejectTransition: →REJECTED + verbatim reason + REJECT log; OTHER-detail rule | Transition not test/live-proven |
| API-17 | DELETE /listings/{id}/images/{imageId} | 🟠 PARTIAL | Route returns 204; LAST_IMAGE 409; T-09 on APPROVED | No sortOrder compaction; no declarationAccepted query gate; untested |
| API-11 | POST /listings/{id}/mark-sold | ⬜ NOT BUILT | Route file absent; SOLD only a read/edit guard | Entire endpoint missing |
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
| API-34 | GET /admin/stats | ⬜ NOT BUILT | No stats route | Entire endpoint missing |

## Screens

| ID | Name | Status | Evidence | Gaps |
|---|---|---|---|---|
| S-02 | Phone entry — /login (step 1) | ✅ VERIFIED | Live `/login` 200 renders phone step; `otp-helpers.test.ts` isValidPhone/toE164 | Firebase OTP send not test-exercised; login-wall is full-route redirect, not in-place sheet |
| S-03 | OTP verify — /login (step 2) | ✅ VERIFIED | 6-digit input + 60s timer/30s cooldown/3-attempt lockout unit-tested; live 200 | Firebase confirm() + post-auth routing Firebase-dependent, untested |
| S-05 | Home / browse — / | ✅ VERIFIED | Live / 200 (brand header, search/bell links, species chips, feed); `/api/v1/listings` 200 | — |
| S-06 | Search results + filters — /listings | ✅ VERIFIED | Live 200 + filter button; species-filtered cursor envelope; `http-listings-validation` | No breed filter control in sheet; multi-page infinite scroll untested |
| S-07 | Listing detail — /listings/[id] | ✅ VERIFIED | Live SSR 200, zero phone in HTML; `http-listings-detail` 200/404; notFound/sold banners | — |
| S-10 | Create wizard host — /sell/new | ✅ VERIFIED | Live 200; 5-step progress shell; autosave POST/PATCH + submit; BR-024 API tested | Client orchestration not E2E-tested; no labeled save-and-exit |
| S-10a | Wizard step 1: species & breed | ✅ VERIFIED | 5-species array; live `/meta/breeds?species=COW` 200 (11 breeds); species change refetch | Rendered as text pills, not spec'd icon grid |
| S-10b | Wizard step 2: animal details | ✅ VERIFIED | BR-022 conditional field set; `listings-validation.test.ts` matrix passes | Age captured as months only (no years input); no DOM E2E |
| S-10c | Wizard step 3: photos | ✅ VERIFIED | PhotoUploader presign→PUT→attach; image-pipeline tests; ≥3 gate, MAX 5 | No reorder UI; single global spinner (no per-photo progress) |
| S-10d | Wizard step 4: price & location | ✅ VERIFIED | Live `?step=4` 200; taluka-compulsory-at-submit unit-tested; districts API | District not prefilled from profile |
| S-10e | Wizard step 5: declaration & review | ✅ VERIFIED | Declaration string verbatim-matches canonical; submit disabled until checked; T-02 test | Step-5 UI source-verified only (auth-gated SPA) |
| S-18 | Admin: login & guard — /admin | ✅ VERIFIED | AdminGate redirect + isAdmin check; requireAdmin per-request; live /admin 200, admin API 401; robots Disallow | Authenticated non-admin (403) path not test-distinguished from anon |
| S-19 | Admin: pending queue — /admin | 🟡 BUILT | Live 200 shell; SLA/soft-flag badges; FIFO repo; API 401 anon | No test/authed check of rendered queue; auto-hide not implemented |
| S-04 | Profile setup — /profile | 🟠 PARTIAL | Client setup form (name/district/village) → POST /users; live 200 | Route is /profile not /profile/setup; no role-flag toggles; Places deferred; form not E2E-tested |
| S-08 | Photo viewer overlay | 🟠 PARTIAL | Inline PhotoCarousel (swipe + dots) on detail page | No full-screen pinch-zoom overlay with counter/close — S-08 component absent |
| S-09 | Seller public profile snippet | 🟠 PARTIAL | Inline SSR seller card (firstName, memberSince, activeListingCount, no phone) | Not a tappable bottom-sheet overlay; shows district only (not village) |
| S-11 | My listings — /sell | 🟠 PARTIAL | Quota meter + status tabs + StatusBadge (7 statuses); live 200 | No Archived tab; no per-card renew/mark-sold actions; only AuthGate shell proven anon |
| S-15 | Profile / settings — /profile | 🟠 PARTIAL | GET/PATCH /users/me routes wired; live 401 API | /profile is the S-04 setup form; no view/edit, language, logout, T&C, delete-account rows |
| S-20 | Admin: listing review detail — inline in /admin | 🟠 PARTIAL | Inline review cards (attributes/photos/seller history); approve/reject + mandatory reason; moderation_log in txn | No dedicated /admin/listings/[id] route; declarationAt not rendered; mutations untested |
| S-01 | Splash & language pick — /welcome | ⬜ NOT BUILT | No /welcome route; root → browse landing | No splash, no मराठी/English picker, language fixed at build time |
| S-12 | Edit listing — /sell/[id]/edit | ⬜ NOT BUILT | No edit route/page; only backend PATCH exists | No pre-filled wizard, no APPROVED-edit or REJECTED-resubmit flow |
| S-13 | Favorites — /favorites | ⬜ NOT BUILT | Live 404; only dead BottomNav link | Entire screen + API missing |
| S-14 | Notifications — /notifications | ⬜ NOT BUILT | Bell links to non-existent route; deferred TODOs | Entire screen + API missing |
| S-16 | Language settings — /profile/language | ⬜ NOT BUILT | No route; only backend languagePref persistence | No toggle UI, no i18n layer |
| S-17 | Report listing modal | ⬜ NOT BUILT | No component/route; only unused reason enum | Entire flow missing |
| S-21 | Admin: reports queue — /admin/reports | ⬜ NOT BUILT | No route/page/API; only openReportCount badge | Entire screen missing |
| S-22 | Admin: users & ban — /admin/users | ⬜ NOT BUILT | No route/API; ban is read-side only | Entire screen missing |
| S-23 | Admin: stats dashboard — /admin/stats | ⬜ NOT BUILT | No stats page/API/audit-log | Entire screen missing |

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
| NFR-04 | Availability & zero-downtime deploys | 🟠 PARTIAL | 3 kill switches (503+retry-after) in middleware; health probe 200; test-CI migrate-deploy | Prod migrate→promote sequence deferred (PS-003 stub); no uptime monitor; kill-switch 503 untested |
| NFR-06 | i18n quality — Marathi-first, 100% coverage | 🟠 PARTIAL | `lang="mr"` default; parity test (99 identical keys); bilingual seed data | 25 UI files hardcode Devanagari; next-intl unwired; catalog only backs API errors |
| NFR-08-AUTHZ | Authorization matrix (deny-by-default) | 🟠 PARTIAL | Full guard set + assertOwnerVisible branches unit-tested; every route wires a guard; masking in http tests | No ST-01 full-matrix or ST-04 IDOR suite through live HTTP; non-owner mutation only helper-level proven |
| BR-090 | Rate limiting (Postgres rolling-window) | 🟠 PARTIAL | 20 interests/day integration-passed; AppError.rateLimited 429 | 60 writes/min limiter is dead code + no rate_limits table; 5 reports/day unbuilt; no parallel-race test |
| NFR-10 | Analytics & instrumentation | 🟠 PARTIAL | Postgres primitives (view_count, interest_events, moderation_log) exist | No /admin/stats aggregation; no @vercel/analytics; 0 of 14 frozen events emitted (all TODO) |
| NFR-11 | PWA installability & offline shell | 🟠 PARTIAL | manifest + icons + sw.js + /offline all live 200; SWR image cache; 2nd-session install gate | No offline write-guard; precache omits fonts/catalogs; no installability/airplane-mode audit |
| NFR-05 | Stability, error budget & Sentry | ⬜ NOT BUILT | Only console.error stub + CSP allowlist entry | No Sentry SDK/init, no PII scrubber, no crash-free tracking, no alert rules |

## Not yet built / known gaps

**NOT BUILT (no implementation):**

- **API-11 / API-12 / API-13** — mark-sold, renew, archive endpoints: no routes, no APPROVED→SOLD / EXPIRED→APPROVED / →ARCHIVED transitions.
- **API-18 / API-19 / API-20** — favorites list/save/unsave: no routes; only the Prisma model and a read-only `isFavorited` helper.
- **API-22** — report listing: no POST route/service; only model, enum, and error codes.
- **API-23 / API-24** — notifications list + mark-read: no routes, no notification code at all.
- **API-28 / API-29 / API-30** — admin reports queue/resolve/dismiss: entirely absent.
- **API-31 / API-32** — admin ban/unban: no admin/users subtree; BANNED is read-side enforcement only.
- **API-33 / API-34** — admin audit-log + stats: moderation_log is write-only; no read/aggregate routes.
- **S-01** — splash & language pick (/welcome): no route, no picker; language fixed at build time.
- **S-12** — edit listing screen: no UI; only the backend PATCH endpoint exists.
- **S-13** — favorites screen (404); **S-14** — notifications screen (bell link dead); **S-16** — language settings; **S-17** — report modal.
- **S-21 / S-22 / S-23** — admin reports queue, users & ban, stats dashboard.
- **NFR-05** — Sentry / error-budget monitoring: only a console.error stub and a CSP allowlist entry.

**PARTIAL (built but incomplete/unproven):**

- **F-02** — profile is create-only; no edit UI for taluka/language/role-flags, no Places assist, no client PATCH screen; PATCH not HTTP-integration-tested.
- **F-05** — no photo zoom; favorite/report/share actions absent; owner/admin status banner not wired (page always renders as anonymous); SOLD/expired render soft 200 instead of 404.
- **F-07** — mark-sold, renew, and archive actions have no implementation anywhere; no ARCHIVED tab; viewCount/interestCount not surfaced.
- **F-08** — favorites core unbuilt (no save/unsave/list API, no `/favorites` page, no heart toggle).
- **F-09** — reporting unbuilt beyond data/enum/error scaffolding (reports slice T-10 not landed).
- **F-10** — admin reports/ban/audit-log/stats endpoints absent; approve/reject/queue have no runtime test.
- **F-11** — notifications: only data model + decorative bell; no writes, no routes, no MSG91 SMS.
- **F-12** — next-intl unwired; UI strings hardcoded Devanagari; no language toggle/runtime switch; no settings screen.
- **API-17** — image delete: no sortOrder compaction, no declarationAccepted gate, endpoint untested.
- **S-04** — route is /profile not /profile/setup; no role-flag toggles; Places deferred; form not E2E-tested.
- **S-08** — only inline swipe+dots carousel; no full-screen pinch-zoom overlay with counter.
- **S-09** — seller snippet is an inline card, not a tappable bottom-sheet overlay; shows district only.
- **S-11** — no Archived tab; no per-card renew/mark-sold; only AuthGate shell proven anon.
- **S-15** — /profile is occupied by the S-04 setup form; no view/edit, language, logout, T&C, or delete-account rows.
- **S-20** — no dedicated /admin/listings/[id] route (inline cards); declarationAt not rendered; mutations untested.
- **NFR-01** — no LHCI/size-limit run captured; configured budgets looser than and not matching the spec split.
- **NFR-02** — no byte-budget enforcement/test; encoding deviates (q80 vs q70, 1600px vs 1280px); Devanagari font ~121KB vs ≤60KB budget.
- **NFR-04** — prod migrate→promote sequence deferred (PS-003 stub); no committed uptime monitor; kill-switch 503 output untested.
- **NFR-06** — 25 UI files hardcode Devanagari; catalog only backs API error strings; parity test does not prove UI string coverage.
- **NFR-08-AUTHZ** — no ST-01 full-matrix or ST-04 IDOR suite through live HTTP; non-owner mutation proven only at helper level.
- **BR-090** — only the 20-interests/day cap is live+verified; the 60-writes/min limiter is unintegrated dead code with no `rate_limits` table; 5-reports/day unbuilt; no parallel-race test.
- **NFR-10** — no /admin/stats aggregation; no @vercel/analytics; 0 of 14 frozen events emitted (all TODO).
- **NFR-11** — no offline write-guard; SW precache omits fonts/catalogs; no installability/airplane-mode audit.

**BUILT (unverified — code complete, no runtime proof):**

- **API-02** GET /users/me — no test for 200-with-phone / 404 / BANNED behavior.
- **API-25 / API-26 / API-27** admin queue / approve / reject — routes wired but no runtime test (mutating admin actions against shared DB out of scope).
- **S-19** admin pending queue — rendered queue behavior not proven under an authenticated admin session.
- **NFR-03** API p95 latency — query design verified, but no timing measured.
- **NFR-07** accessibility — tokens/components in place, but no automated axe run or machine check.

## Verification method

- **typecheck:** `tsc --noEmit` clean (exit 0).
- **unit:** `vitest tests/unit` → **125 passed (16 files)**.
- **build:** `next build` clean, **33 route entries registered** (16 dynamic `/api/v1` + 17 page/asset routes), incl. the new `/api/v1/listings/[id]/interest`.
- **integration (authored, live Neon + MinIO, `RUN_DB_TESTS=1`):** `listing-writepath` + `image-pipeline` + `interest-writepath` → **16 passed**.
- **integration (HTTP layer, live Neon):** `http-listings-detail` + `http-listings-validation` + `http-users` → **11 passed + 2 expected-fail**.
- **live smoke (dev server :3009):** every public page, PWA/SEO asset, and API surface curled for status codes; auth-gated APIs return **401** anon; **BR-066 phone scan** of detail HTML + public API + sitemap returned **EMPTY** (no phone leak).
- **known gap surfaced live:** `GET /favorites` → **404**.

> Status discipline: no item is rated above its verified verdict. Every ✅ row cites a concrete passing test or live check; 🟡 items are code-complete but lack runtime proof; 🟠 items have at least one built-and-proven sub-behavior alongside missing or unproven pieces; ⬜ items have no implementation beyond scaffolding.