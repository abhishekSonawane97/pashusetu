# Feature: Favorites (F-08)

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 1.0 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-04 |
| **Depends on** | [../01-prd/README.md](../01-prd/README.md) (F-08) · [../04-business-rules/README.md](../04-business-rules/README.md) (BR-070, BR-061, BR-090 #11–12) · [../06-user-flows/README.md](../06-user-flows/README.md) (Flow C, S-06, S-07, S-13) · [auth.md](auth.md) · [listing-detail.md](listing-detail.md) |

## Purpose

Buyers evaluate livestock over days and multiple farm visits. The heart toggle is their shortlist tool: save a listing from any card or detail page, find it again under "आवडत्या जाहिराती" (Saved), and see honestly when a saved animal is sold or gone. It drives retention and is a strong demand signal.

## User stories

- As a **trader comparing several animals during the week**, I want to save listings so I can decide which farms to visit.
- As a **dairy buyer**, I want my saved list to show which animals have already sold so I stop planning visits for them.
- As a **buyer on two phones**, I want the same saved list on both devices.

## Preconditions & permissions

| Aspect | Value |
|---|---|
| Who | Any logged-in `ACTIVE` user with a complete profile (BR-070, BR-013) |
| Login required | Yes — anonymous heart taps raise the login wall; the favorite applies automatically after login (BR-061) |
| Role | None; users cannot favorite their **own** listings (403 `FORBIDDEN`, BR-070) |
| Target | Only APPROVED listings can be newly favorited (BR-070) |

## UX workflow

1. A heart icon renders on every result card (S-06), on the listing detail page (S-07), and on saved cards (S-13). Filled = saved.
2. Tap while logged in → **optimistic toggle** (icon flips instantly) → `POST /users/me/favorites {listingId}` or `DELETE /users/me/favorites/{listingId}`. On failure the icon reverts with a retry toast.
3. Tap while anonymous → login sheet; after auth the intended favorite is applied automatically (login-wall contract, doc 06 §3.2).
4. Favorites tab → **S-13** "आवडत्या जाहिराती": `GET /users/me/favorites`, newest-saved first, cursor-paginated. Cards match the S-06 card layout.
5. Saved listings that later leave APPROVED stay in the list, greyed out with a Marathi status tag — "विकले गेले" (sold), "मुदत संपली" (expired), "उपलब्ध नाही" (unavailable — hidden/archived) — with contact actions disabled; the user can remove them (heart or swipe-to-remove).
6. Tapping a saved card → S-07 (a non-APPROVED one shows the sold/unavailable state, [listing-detail.md](listing-detail.md)).

## Fields & validation

| Field | Type | Required | Validation rule | Error message EN | Error message MR |
|---|---|---|---|---|---|
| listingId | string (cuid) | Yes | Must reference an APPROVED listing; not the caller's own listing | Could not save this listing | ही जाहिरात जतन होऊ शकली नाही |
| (limit) | — | — | Max 200 favorites per user → 409 `FAVORITE_LIMIT_REACHED` (BR-070) | You can save up to 200 listings. Remove some old ones. | जास्तीत जास्त 200 जाहिराती जतन करता येतात. जुन्या काढून टाका. |

## Business logic

- Uniqueness per (user, listing) enforced by a DB unique constraint; re-POSTing an existing pair is **idempotent** — 200, no duplicate row — BR-070.
- Limit 200 favorites/user → 409 `FAVORITE_LIMIT_REACHED` — BR-070, BR-090 #11.
- Own-listing favoriting → 403 `FORBIDDEN` (favorites feed demand-side metrics) — BR-070.
- Listings leaving APPROVED **stay** in the list greyed-out with status; rows are removed only by the user or account deletion (BR-015) — BR-070.
- List is cursor-paginated (default 20 / max 50) — BR-090 #12; no client-side cap (100+ favorites simply paginate).
- Favorites are server-side state: two devices converge on refresh (PRD F-08 edge).
- Rapid double-taps: client debounces; server idempotency guarantees the final state matches the last intent (PRD F-08 edge).
- Favorite counts are **not** shown publicly in MVP — no social-proof gaming surface (PRD F-08 AC-6).

## API usage

| Method + path | When |
|---|---|
| `POST /api/v1/users/me/favorites` | Heart tap to save (body `{ "listingId": "…" }`) |
| `DELETE /api/v1/users/me/favorites/{listingId}` | Heart tap to unsave / swipe-remove on S-13 |
| `GET /api/v1/users/me/favorites` | S-13 load + pagination; also hydrates heart states after login |

## States

| State | What the user sees |
|---|---|
| Loading | S-13 card skeletons on first load; heart toggles are optimistic (no spinner). |
| Empty | "अजून एकही जाहिरात जतन केलेली नाही" (no listing saved yet) + CTA "जनावरे पाहा" (browse animals) → S-06. |
| Error | Failed toggle reverts the icon with toast "जतन झाले नाही. पुन्हा प्रयत्न करा." (Not saved. Try again.); 409 limit → the limit message above; offline → toggle disabled with the offline banner (README §3.3 — no queued writes). |
| Success | Heart fills/unfills instantly; item appears/disappears from S-13 on next visit or pull-to-refresh; save toast on S-07: "जतन केले" (saved). |
| Edge | **Saved listing sold/expired/archived (incl. by a seller ban, BR-014):** greyed card with status tag, contact disabled, removable — never vanishes silently. **Anonymous tap:** login wall, then auto-apply. **Two devices:** server state wins on refresh. **Re-POST of an existing pair:** 200, no duplicate. |

## Analytics

| Event | Fired when | Properties |
|---|---|---|
| `favorite_add` | 2xx on `POST /users/me/favorites` (not on removals) | `listingId`, `species`, `districtId`, `source` (`search_card` \| `detail`) |

Removals are measured server-side from the `favorites` table (no frozen event exists; README §3.4).

## Acceptance criteria

1. Tapping the heart on a card or detail page while logged in saves/unsaves with optimistic UI; the icon state is consistent across S-06, S-07, and S-13 (hydrated from the server after login/refresh).
2. An anonymous heart tap opens the login sheet; after successful login the intended favorite is applied automatically without a second tap.
3. `GET /users/me/favorites` returns saved listings newest-saved first, cursor-paginated (default 20, max 50).
4. Re-POSTing an existing (user, listing) pair returns success without creating a duplicate row (DB unique constraint); rapid double-taps settle on the user's last intent.
5. The 201st favorite returns 409 `FAVORITE_LIMIT_REACHED` with the canonical MR copy; favoriting one's own listing returns 403 `FORBIDDEN` and the UI hides the heart on own listings.
6. Saved listings that are no longer APPROVED remain listed, greyed with the correct Marathi status tag and disabled contact actions, and can be removed by the user.
7. A failed toggle (network/API error) reverts the optimistic icon and shows a retry toast; no favorite write is ever queued offline.
8. No public surface shows favorite counts.

## Out of scope

- Price-drop / back-in-market alerts on saved listings, folders/labels, compare view — Phase 2 (PRD F-08 future improvements).
- Offline-cached favorites beyond the NFR-11 read cache — Phase 2.
- Public favorite counts or "X people saved this" social proof — deliberately excluded in MVP.

## Acceptance checklist

- [x] All 12 mandatory sections of README §2 present in order, plus this checklist per foundation §7
- [x] Favorite rules match BR-070 exactly: logged-in `ACTIVE` user with complete profile (BR-013), only APPROVED listings favoritable, own-listing favoriting → 403 `FORBIDDEN`, re-POST idempotent (DB unique constraint, no duplicate row), rows persist greyed-out when a listing leaves APPROVED
- [x] Limits cited from BR-090: 200 favorites/user → 409 `FAVORITE_LIMIT_REACHED` (#11) with canonical MR copy; list cursor-paginated default 20 / max 50 (#12)
- [x] Anonymous heart tap follows the login-wall contract (BR-061, doc 06 §3.2): login sheet, then the intended favorite auto-applies without a second tap
- [x] Only the canonical `/api/v1` endpoints referenced (`POST`/`DELETE`/`GET /users/me/favorites`); screens cited as S-06/S-07/S-13 per doc 06 Flow C
- [x] All five states defined (README §3.1), including greyed sold/expired/unavailable tags with Marathi copy and offline toggle-disable per README §3.3 (no queued writes)
- [x] Analytics limited to the frozen `favorite_add` event; removals measured server-side (README §3.4); no public favorite counts (PRD F-08 AC-6)
- [x] ≥ 6 testable acceptance criteria (8 present); Marathi strings in Devanagari with English gloss; no TBD; no contradiction with D1–D10 or docs 04/06/08
