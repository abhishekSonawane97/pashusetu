# Feature: My Listings Management (F-07)

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 1.0 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-04 |
| **Depends on** | [../01-prd/README.md](../01-prd/README.md) (F-07) · [../04-business-rules/README.md](../04-business-rules/README.md) (BR-024, BR-028, BR-030–BR-033, BR-073, BR-074) · [../06-user-flows/README.md](../06-user-flows/README.md) (Flow B, S-11, S-12) · [listing-create.md](listing-create.md) |

## Purpose

The seller's control room: see every own listing by status, resume drafts, fix rejections, update price instantly, mark sold, renew expired listings in one tap, and archive. This is where supply stays fresh (renewals, metric G-08) and search stays honest (mark-sold), and where the rejection feedback loop closes (metric G-12).

## User stories

- As a **farmer**, I want to mark my cow sold in one tap so buyers stop calling after the deal is done.
- As a **farmer whose listing was rejected**, I want to read exactly why and fix it, so my animal goes live on the next try.
- As a **repeat seller**, I want to renew an expired listing without re-entering anything, because the animal is still for sale.

## Preconditions & permissions

| Aspect | Value |
|---|---|
| Who | The listing's seller only (`seller_id`), authenticated, `ACTIVE`, complete profile (BR-013, BR-033) |
| Login required | Yes — Sell tab raises the login wall (BR-061) |
| Role | None; admins never edit listing content (BR-028) |
| Other users | Cannot see or act on this surface; non-owner mutation attempts → 403 `FORBIDDEN` |

## UX workflow

1. Sell tab → **S-11** "माझ्या जाहिराती" with status tabs: अपूर्ण (Drafts), तपासणीत (In review / PENDING), चालू (Live / APPROVED), विकलेल्या (Sold), नाकारलेल्या (Rejected), मुदत संपलेल्या (Expired), बंद (Archived). Data via `GET /users/me/listings` (newest first, cursor-paginated, each card with `viewCount` + total interest-event count). Header shows the active-count meter "7/10" toward BR-024.
2. Per-card actions by status (only valid transitions render, BR-031/BR-032):
   - **DRAFT:** "पुढे चालू ठेवा" (continue → wizard at first incomplete step), "काढून टाका" (archive).
   - **PENDING:** status note "तपासणी सुरू आहे — साधारण 24 तास" (under review — approx. 24 hours) with submission timestamp (BR-041); edit (→ S-12, with the queue-delay warning "बदल केल्यास तपासणीला थोडा जास्त वेळ लागू शकतो", BR-040); archive. Auto-hidden listings show "तक्रारींमुळे तपासणीसाठी थांबवले आहे" (paused for review due to reports).
   - **APPROVED:** "जाहिरात बदला" (edit → S-12), "विकले गेले म्हणून नोंद करा" (mark sold), archive; days-left-to-expiry chip.
   - **REJECTED:** admin's rejection reason verbatim in Marathi (BR-043 label + free text) pinned on the card, CTA "दुरुस्त करून पुन्हा पाठवा" (fix and resend → S-12); archive.
   - **EXPIRED:** "30 दिवसांसाठी पुन्हा सुरू करा" (restart for 30 days → one-tap renew); archive. **No edit action** (BR-028 — renew first, then edit).
   - **SOLD / ARCHIVED:** read-only cards, no actions; a permanent "+ नवीन जाहिरात" CTA sits beside them (doc 06 §7 invariant 7).
3. **Mark sold:** confirm dialog "विकले गेले म्हणून नोंद करायची का? हे परत बदलता येणार नाही." (Mark as sold? This cannot be undone.) → `POST /listings/{id}/mark-sold` → card moves to विकलेल्या; listing leaves public search immediately (T-06).
4. **Renew:** one tap → `POST /listings/{id}/renew` → APPROVED with `expires_at = now + 30 days`, no re-moderation (T-08, BR-074); inline confirmation "जाहिरात 30 दिवसांसाठी पुन्हा सुरू झाली" (listing restarted for 30 days).
5. **Archive:** confirm dialog "जाहिरात कायमची बंद होईल. पुन्हा सुरू करता येणार नाही." (The listing will close permanently. It cannot be reopened.) → `POST /listings/{id}/archive` (T-11).
6. **Edit — S-12** "जाहिरात बदला": single scrollable page with the same fields + validation as the wizard ([listing-create.md](listing-create.md) Fields table), pre-filled; photos managed with the same presign/attach/delete flow.
   - On an APPROVED listing, a warning banner explains BR-028: price-only saves keep it live; any other change sends it back for review. Changing a non-price field triggers the confirm dialog "बदल केल्यास जाहिरात पुन्हा तपासणीत जाईल" (if you make changes, the listing will go back for review). Saving a non-price change routes through resubmit (declaration re-affirmed, BR-027) → PENDING (T-09).
   - On a REJECTED listing, the rejection reason (and reason history, if rejected more than once) is pinned on top; saving ends with "पुन्हा पाठवा" (resend) → `POST /listings/{id}/submit` (T-05).
   - Price-only edit: `PATCH /listings/{id}` with `priceInr`/`negotiable` only → saves instantly, stays APPROVED, no dialog, `expires_at` unchanged (BR-028, BR-073).

## Fields & validation

Edit fields are identical to [listing-create.md](listing-create.md) (same table, same EN/MR errors, BR-022 matrix enforced). Additional surface-specific fields:

| Field | Type | Required | Validation rule | Error message EN | Error message MR |
|---|---|---|---|---|---|
| priceInr (quick edit) | integer | Yes | ₹500 – ₹10,00,000 (BR-026) | Price must be between ₹500 and ₹10,00,000 | किंमत ₹500 ते ₹10,00,000 च्या दरम्यान टाका |
| negotiable (quick edit) | boolean | Yes | Toggle | — | — |
| markSold confirmation | boolean (dialog) | Yes | Explicit confirm tap; irreversible (BR-032) | Confirm to mark as sold | विकले गेले नक्की करा |
| archive confirmation | boolean (dialog) | Yes | Explicit confirm tap; irreversible (BR-032) | Confirm to remove the listing | जाहिरात काढणे नक्की करा |

## Business logic

- The server computes the changed-field set on `PATCH /listings/{id}`; the price-only exception (`price_inr`/`negotiable`) is applied server-side, never trusted from a client hint — BR-028.
- Status → allowed actions matrix is exactly BR-028/BR-031: DRAFT edit-all; PENDING edit-all (bumps `updated_at`, moves to back of FIFO queue, BR-040); APPROVED price-only stays live, other edits → PENDING (T-09); REJECTED edit + resubmit (T-05); EXPIRED **no edit** — renew first (else 409 `EDIT_NOT_ALLOWED`); SOLD/ARCHIVED never editable/renewable (409 `EDIT_NOT_ALLOWED`).
- Renew: only from EXPIRED (else 409 `INVALID_STATE_TRANSITION`); sets `expires_at = now + 30d`, `approved_at` unchanged, no re-moderation, unlimited renewals but each needs an explicit tap — BR-074, BR-073.
- Renew needs no extra quota check — an EXPIRED listing already counts toward the 10-ACTIVE cap (BR-024). Creating a new listing while at 10 is what gets blocked (`LISTING_LIMIT_REACHED`).
- "Delete" does not exist: the UI verb "काढून टाका" maps to archive (T-11); ARCHIVED is terminal, frees a quota slot, and is never restored — BR-028, BR-032.
- All transitions run with a status precondition (`UPDATE … WHERE status = <from>`), so stale taps (e.g. mark-sold on a listing that just expired) return 409 `INVALID_STATE_TRANSITION` and the row refreshes — BR-033.
- Mark-sold is idempotent from the client's perspective: a double-tap's second call returns the already-SOLD listing (PRD F-07 edge).
- Resubmission after rejection has no hard count limit; 3+ rejections badge the listing for admin account review — BR-044.

## API usage

| Method + path | When |
|---|---|
| `GET /api/v1/users/me/listings` | S-11 load + tab switches + pull-to-refresh (cursor-paginated) |
| `PATCH /api/v1/listings/{id}` | S-12 saves (price-only or full edit) and draft edits |
| `POST /api/v1/listings/{id}/submit` | Resubmit from S-12 (REJECTED → PENDING; APPROVED non-price edit → PENDING with re-affirmed declaration) |
| `POST /api/v1/listings/{id}/mark-sold` | Mark-sold confirm on S-11 |
| `POST /api/v1/listings/{id}/renew` | Renew tap on an EXPIRED card |
| `POST /api/v1/listings/{id}/archive` | Archive confirm on S-11 |
| `POST /api/v1/uploads/presign` · `POST /api/v1/listings/{id}/images` · `DELETE /api/v1/listings/{id}/images/{imageId}` | Photo changes inside S-12 (same flow as create) |

## States

| State | What the user sees |
|---|---|
| Loading | Card-list skeleton on S-11; per-action inline spinners (the tapped card action disables while in flight). |
| Empty | Zero listings: illustration + "पहिली जाहिरात टाका" (Post your first listing) CTA → wizard. Per-tab empties show a one-liner (e.g. Sold tab: "अजून एकही जनावर विकले गेले नाही" — no animal sold yet). |
| Error | Action failure toast with retry (README §3.2); 409 `INVALID_STATE_TRANSITION` silently refreshes the affected row to its true status and shows "स्थिती बदलली आहे — यादी ताजी केली" (the status changed — list refreshed). |
| Success | Mark-sold/renew/archive: card animates to its new tab + confirmation toast; price-only edit: "किंमत बदलली" (price updated) toast, listing stays live. |
| Edge | **Expired while screen open:** renew appears after pull-to-refresh; a stale mark-sold tap returns 409 and refreshes. **Auto-hidden by reports (T-10):** card moves to तपासणीत with the reports note; no report details disclosed. **Renew raced with admin action:** guarded by the status precondition; 409 → refresh. **Editing PENDING during admin review:** updates the same pending record; the queue-delay warning was shown before saving (BR-040). |

## Analytics

No frozen NFR-10 client event covers this surface. Measurement is server-side product truth: `sold_at - approved_at` (G-08), renewals via `expires_at` resets, rejection loop via `moderation_log` (G-12), repeat sellers via `listings.seller_id` (G-11) — all exposed through `GET /api/v1/admin/stats`. No new client events (README §3.4).

## Acceptance criteria

1. `GET /users/me/listings` returns all the seller's listings across every status, newest first, cursor-paginated, each with `viewCount` and interest-event count; the S-11 tabs group them exactly by the seven statuses.
2. Mark-sold renders only on APPROVED cards, requires the irreversible-confirm dialog, sets SOLD + `sold_at`, and removes the listing from public search immediately; SOLD cards render no edit/renew/archive actions.
3. Renew renders only on EXPIRED cards; one tap returns the listing to APPROVED with `expires_at = now + 30 days` and no re-moderation; renewing a non-EXPIRED listing via API returns 409 `INVALID_STATE_TRANSITION`.
4. An EXPIRED listing exposes no edit path; a forced `PATCH` returns 409 `EDIT_NOT_ALLOWED`; after renewal, editing follows the APPROVED rules including the re-moderation warning.
5. A REJECTED card shows the admin's rejection reason verbatim in Marathi; "दुरुस्त करून पुन्हा पाठवा" opens S-12 with the reason pinned; resubmit moves it to PENDING with the declaration re-affirmed and the reason cleared.
6. A price-only save on an APPROVED listing keeps it APPROVED with `expires_at` unchanged and no confirmation dialog; changing any other field (or any photo) first shows the re-moderation confirm dialog and, on save + resubmit, moves the listing to PENDING and out of public view.
7. Archive is available from every non-terminal status with the permanent-closure warning; archived listings appear read-only under बंद and free a quota slot; the "7/10" meter updates.
8. Non-owner mutation attempts on any of these endpoints return 403 `FORBIDDEN`; concurrent conflicting transitions resolve via the status precondition with 409 and a row refresh.

## Out of scope

- Sold-price capture at mark-sold, listing performance insights, bulk renew, share-my-listing shortcuts — Phase 2/3 (PRD F-07 future improvements).
- Un-archive / restore of ARCHIVED listings — does not exist (BR-032).
- Admin editing of listing content — admins only approve/reject/ban (BR-028).

## Acceptance checklist

- [x] All 12 mandatory sections of README §2 present in order, plus this checklist per foundation §7
- [x] Status → allowed-actions matrix matches BR-028/BR-031/BR-032 exactly: DRAFT edit-all; PENDING edit-all with FIFO re-queue warning (BR-040); APPROVED price-only stays live, any other change → PENDING via resubmit (T-09) with declaration re-affirmed (BR-027); REJECTED edit + resubmit (T-05); EXPIRED renew-only, no edit; SOLD/ARCHIVED terminal and read-only
- [x] Price-only exception computed server-side from the changed-field set (`price_inr`/`negotiable` only, BR-028/BR-073); renew only from EXPIRED, `expires_at = now + 30 days`, `approved_at` unchanged, no re-moderation, unlimited one-tap renewals (BR-074, T-08); no un-archive (BR-032)
- [x] Error codes match the doc 08 registry: 403 `FORBIDDEN` for non-owner mutations, 409 `EDIT_NOT_ALLOWED` / `INVALID_STATE_TRANSITION` via status preconditions on every transition (BR-033); mark-sold idempotent on double-tap
- [x] Rejection reason shown verbatim in Marathi with BR-043 label + free text; 3+ rejections badge the listing for admin account review (BR-044); quota meter "7/10" tracks BR-024 with ARCHIVED freeing a slot
- [x] Only canonical `/api/v1` paths from doc 08 referenced; screens cited as S-11/S-12 per doc 06 Flow B; Marathi strings are Devanagari with English gloss
- [x] Analytics adds no new client events (README §3.4); measurement is server-side via `GET /api/v1/admin/stats` feeding G-08/G-11/G-12
- [x] All five states defined; ≥ 6 testable acceptance criteria; no TBD/TODO; no contradiction with D1–D10 or docs 04/06/08
