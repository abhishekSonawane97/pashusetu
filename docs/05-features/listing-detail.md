# Feature: Listing Detail Page (F-05)

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 1.1 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-14 |
| **Depends on** | [../01-prd/README.md](../01-prd/README.md) (F-05) · [../04-business-rules/README.md](../04-business-rules/README.md) (BR-034, BR-060, BR-062, BR-066) · [../06-user-flows/README.md](../06-user-flows/README.md) (Flow C, S-07, S-08, S-09) · [contact-seller.md](contact-seller.md) · [favorites.md](favorites.md) · [reporting.md](reporting.md) · [search-filters.md](search-filters.md) (the related-animals shelf reuses its APPROVED search — query contract `listingRepo.searchApproved` by district + species) |

## Purpose

The conversion surface: one public, server-side-rendered page per APPROVED listing where a buyer sees every photo and every claimed attribute and decides to contact. SSR makes each listing a shareable, Google-indexable URL (NFR-09), turning listings into organic acquisition — while the seller's phone number never appears anywhere on it (BR-066).

## User stories

- As a **dairy-farm buyer**, I want every claimed attribute and all photos on one page so I can shortlist a cow before spending a day traveling to inspect it.
- As a **trader**, I want to share a listing to my WhatsApp group so my partners can see the same animal.
- As a **seller viewing my own listing**, I want a shortcut to edit it instead of useless contact buttons.

## Preconditions & permissions

| Aspect | Value |
|---|---|
| Who | Everyone — anonymous included (BR-060) |
| Login required | No for viewing. Contact, favorite, and report actions on this page are login-gated downstream (BR-061) |
| Role | Owner and admins can additionally view the listing in any status, with a status banner (BR-034) |
| Data visibility | Public fetch succeeds only for APPROVED listings; any other status → 404 `LISTING_NOT_FOUND` (BR-034) |

## UX workflow

1. Entry from S-05/S-06 cards, S-13 favorites, S-14 notifications, or a shared deep link `/listings/{id}` → **S-07** renders server-side: photo carousel, price + "बोलणी होऊ शकते" (negotiable) badge, attribute table, location (village, taluka, district), description, seller row, posted date, and the sticky contact bar (कॉल करा / WhatsApp / आवड कळवा — specified in [contact-seller.md](contact-seller.md)), plus the favorite heart and "तक्रार करा" (report) triggers. Two floating controls overlay the carousel: a fixed **top-left back/home control** (aria-label "मुख्य पानावर जा", go to home page) and a fixed **top-right share control** (aria-label "शेअर करा", share) — share is this floating control, not part of the favorite-heart / report row. The back control always navigates to **home (`/`)**, never `router.back()`: a WhatsApp-shared deep link has no safe in-app history, so `back()` would strand the buyer on a blank/external page whereas home never strands; it is fixed and stays reachable while scrolling, and is present on the detail page and on the sold/unavailable banner states (workflow step 9).
2. **Photo carousel:** swipeable, position indicator ("2/5"); first image is the preloaded LCP element (NFR-02). Tapping opens **S-08** full-screen viewer with pinch-zoom and swipe. A single-photo listing renders without swipe affordance or counter.
3. **Attribute table** (Marathi labels): जात (breed), लिंग (sex), वय (age, rendered as years + months from `ageMonths`), वजन (weight), दूध उत्पादन (milk yield l/day), वेत (lactation), गाभण (pregnant), लसीकरण (vaccinated). Unset optional fields are omitted entirely — never "null", "-" or "N/A".
4. **Description:** collapsed to 4 lines with "अधिक वाचा" (read more) toggle when longer.
5. **Seller row** → **S-09** bottom sheet: first name, village + district, member-since month, count of active listings, and "या विक्रेत्याच्या इतर जाहिराती" (this seller's other listings) → S-06 filtered. **No phone number anywhere** (BR-062, BR-066).
6. **Related animals:** below the seller card sit one or more horizontal, swipe-scrollable shelves of other APPROVED listings, rendered as S-06-style ListingCards. The MVP ships a single **"nearby"** shelf — other animals of the **same species in the same district** — titled "{जिल्हा} मधील जनावरे" (animals in {district}) with a "सर्व पहा" (see all) link → S-06 filtered by that district + species. The current listing is excluded and animals are de-duplicated across shelves; a district with no other animals renders no shelf (the section is simply absent). Server-rendered so the card links are in the SSR HTML (SEO, NFR-09); pure-CSS scroll-snap, no client JS. The shelf reuses the APPROVED search — its query contract lives in [search-filters.md](search-filters.md).
7. **Share:** the primary path is the native **Web Share sheet** (`navigator.share`), which on mobile offers WhatsApp / Facebook / Telegram / etc. directly. On desktop and browsers without Web Share it falls back to a bottom sheet ("शेअर करा", share) of explicit per-platform links — **WhatsApp** (wa.me), **Facebook** (sharer), **Telegram** (t.me) — plus **"लिंक कॉपी करा"** (copy link), which flips to "लिंक कॉपी झाली ✓" (link copied) after a tap. The payload is the Marathi blurb "{जात} {प्रजाती} — ₹{किंमत}\n{गाव, तालुका, जिल्हा}\nपशुसेतू वर पहा 👇" (breed + species — price · location · "see it on पशुसेतू") followed by the public {url}. It carries **no seller phone** (BR-066); the Open Graph image is the listing's card variant so WhatsApp previews show the animal (NFR-09).
8. **Owner view:** contact bar replaced by "ही तुमची जाहिरात आहे" (this is your listing) with a "जाहिरात बदला" (edit) shortcut → S-12; the owner also sees their own non-APPROVED listings here with a status banner. Admins see any status with a banner.
9. **Unavailable state:** a public fetch of a non-APPROVED listing (sold, expired, hidden, rejected, archived, draft) returns HTTP 404 → S-07 renders "ही जाहिरात आता उपलब्ध नाही" (this listing is no longer available) with the fixed **top-left back/home control** and a browse CTA reading "इतर जनावरे पहा" (see other animals) → S-06 (`/listings`). When the client already knows the status is SOLD (e.g. navigating from a favorites card, or the status changed while the page was open), it shows the specific banner "हे जनावर विकले गेले आहे" (this animal has been sold) with the contact bar hidden — this banner state also renders the top-left back/home control — the API itself still 404s SOLD listings publicly (BR-034). A hard not-found path calls Next `notFound()` → the global branded Marathi 404 page (owned by the frontend/routing doc).

## Fields & validation

Read-only surface — no user input except taps. Rendered-field rules:

| Field | Type | Required | Validation rule (render rule) | Error message EN | Error message MR |
|---|---|---|---|---|---|
| id (route param) | string (cuid) | Yes | Must resolve to an APPROVED listing for public callers, else 404 state | This listing is no longer available | ही जाहिरात आता उपलब्ध नाही |
| priceInr | integer | Yes | Rendered "₹1,25,000" — Latin digits, Indian grouping | — | — |
| ageMonths | integer | Yes | Rendered as "3 वर्षे 2 महिने" (years + months) | — | — |
| optional attributes | various | No | Omitted when null — never a placeholder value | — | — |
| description | string | Yes | Rendered as typed (never machine-translated, F-12); 4-line collapse | — | — |
| photos | 1–5 | Yes | Detail-size WebP variants (≤ 180 KB each, NFR-02) with explicit dimensions + `srcset` | Photo could not load | फोटो दिसू शकला नाही |

## Business logic

- Public `GET /listings/{id}` returns full data for APPROVED only; owner/admin see any status (with banner); everything else → 404 `LISTING_NOT_FOUND` — BR-034. Non-APPROVED URLs therefore drop out of search indexes (NFR-09).
- `view_count` increments by 1 on **every public detail fetch** of an APPROVED listing — **no deduplication in MVP**; seller and admin views never increment it — BR-034. The write is fire-and-forget (PRD FR-09); the seller reads the count on S-11.
- The seller's phone never appears in the payload, SSR HTML, SEO metadata, OG tags, or the S-09 sheet — the only egress is the interest endpoint — BR-062, BR-066; verified by an automated phone-concealment test ([../14-testing-qa/README.md](../14-testing-qa/README.md)).
- SSR with unique Marathi `<title>`/`<meta description>`, Schema.org `Product` JSON-LD (name, price, availability), canonical URL, `hreflang` mr-IN/en-IN pairs — NFR-09.
- With JavaScript unavailable (2G/failed load), SSR HTML still shows photos, attributes and price; contact buttons render as plain links prompting login (PRD F-05 edge).
- Contact, favorite, and report behaviors on this page are owned by their feature files; this page hosts their triggers.

## API usage

| Method + path | When |
|---|---|
| `GET /api/v1/listings/{id}` | SSR render of S-07 and client-side revalidation on focus/back-navigation |
| `POST /api/v1/listings/{id}/interest` | Via the contact bar — contract in [contact-seller.md](contact-seller.md) |
| `POST /api/v1/users/me/favorites` · `DELETE /api/v1/users/me/favorites/{listingId}` | Via the heart — contract in [favorites.md](favorites.md) |
| `POST /api/v1/listings/{id}/report` | Via the report modal — contract in [reporting.md](reporting.md) |

## States

| State | What the user sees |
|---|---|
| Loading | SSR delivers content-first paint; client hydration shows skeletons only for authed extras (favorite state, own-listing check). Photo tiles show blur-up placeholders until the WebP loads. |
| Empty | Not applicable to a valid listing (≥ 1 photo guaranteed by BR-023); an unset optional attribute is simply omitted. |
| Error | 404 → "ही जाहिरात आता उपलब्ध नाही" + browse CTA (HTTP 404 status for SEO); the 404 / sold / unavailable states still render the fixed top-left back-to-home control, so a deep-linked buyer is never stranded. Photo load failure: grey placeholder with the alt text; page remains usable. Network loss: cached version renders with the stale-data banner (README §3.3). |
| Success | Full page as specified; the native Web Share sheet opens (or the explicit WhatsApp / Facebook / Telegram + copy-link fallback sheet on desktop) with the Marathi prefill; carousel counter tracks position. |
| Edge | **Turns non-APPROVED while open:** a contact tap gets 404 from the interest endpoint → page swaps to the unavailable/sold state without a crash. **Owner opens own listing:** contact bar replaced by the edit shortcut; no self-interest possible. **1-photo listing:** no swipe affordance/counter. **Very long description:** 4-line collapse with "अधिक वाचा". **SOLD known client-side:** sold banner + hidden contact bar (workflow step 8). |

## Analytics

| Event | Fired when | Properties |
|---|---|---|
| `listing_view` | S-07 successfully rendered for an APPROVED listing (client-side, once per page view) | `listingId`, `species`, `districtId`, `source` (`search` \| `home` \| `favorites` \| `notification` \| `share_link`) |

`view_count` (server-side, BR-034) is independent of this client event.

## Acceptance criteria

1. `GET /listings/{id}` returns full listing data to anyone for APPROVED listings; for any other status it returns 404 `LISTING_NOT_FOUND` unless the caller is the owner or an admin, who see it with a status banner.
2. The photo carousel supports swipe and full-screen pinch-zoom (S-08) with a position indicator; the first image is the preloaded LCP element; a single-photo listing shows no swipe affordance or counter.
3. All populated attributes render in a labeled Marathi table; unset optional fields are omitted entirely — the strings "null", "-", "N/A" never appear.
4. Neither the page payload, the SSR HTML source, SEO/OG metadata, nor the S-09 seller sheet contains the seller's phone number — enforced by the automated phone-concealment test.
5. `view_count` increments on every public detail fetch of an APPROVED listing and never for the owner or admins; the count is visible to the seller on S-11.
6. The share action uses the native Web Share API when available and otherwise a fallback sheet with explicit WhatsApp / Facebook / Telegram links plus copy-link; it carries the canonical Marathi blurb and public URL, contains no seller phone, and the OG image is the listing's card variant.
7. A deleted/expired/sold listing URL returns HTTP 404 with the friendly "ही जाहिरात आता उपलब्ध नाही" state and a browse CTA; when the client knows the listing is SOLD it shows the sold banner and hides the contact bar.
8. The owner viewing their own listing sees "ही तुमची जाहिरात आहे" with an edit shortcut instead of contact buttons.
9. The page meets NFR-01 budgets on Fast 3G (TTI ≤ 5 s, LCP ≤ 4 s) with detail images ≤ 180 KB WebP variants.
10. Below the seller card, a horizontal "nearby" shelf shows other APPROVED animals of the same species in the same district, excludes the current listing, and is server-rendered (the card links are present in the SSR HTML); a district with no other animals renders no shelf.
11. A fixed back control on the detail page — and on the sold/unavailable banner states — always navigates to home (`/`), so a freshly opened shared/deep link is never a dead-end.

## Out of scope

- Vet certificates, seller ratings, district price context — Phase 2/3 (PRD F-05 future improvements).
- A public "recently sold" showcase — SOLD listings 404 publicly in MVP (BR-034; Phase 2 idea).
- Per-viewer view-count deduplication — Phase 2 refinement (BR-034).

## Acceptance checklist

- [x] All 12 mandatory sections of README §2 present in order, plus this checklist per foundation §7
- [x] Visibility rules match BR-034 exactly: public fetch APPROVED-only, owner/admin see any status with a banner, everything else 404 `LISTING_NOT_FOUND`
- [x] Phone concealment restated per BR-062/BR-066 — no seller phone in payload, SSR HTML, SEO/OG metadata, or the S-09 sheet — with the automated phone-concealment test cited (doc 14)
- [x] `view_count` semantics match BR-034: increments on every public detail fetch, no deduplication in MVP, never for owner/admin, fire-and-forget (FR-09), read by the seller on S-11
- [x] Only canonical `/api/v1` endpoints referenced; contact, favorite, and report contracts delegated to contact-seller.md, favorites.md, reporting.md
- [x] Screens cited as S-07/S-08/S-09 per doc 06 Flow C; carousel, attribute table, description collapse, seller sheet, share prefill, owner view, and unavailable/sold states all specified
- [x] SEO/SSR meets NFR-09 (unique Marathi title/meta, `Product` JSON-LD, canonical URL, hreflang, OG card image) and performance budgets NFR-01/NFR-02 (preloaded LCP image, detail WebP variants ≤ 180 KB)
- [x] Analytics limited to the frozen `listing_view` event; Marathi strings are Devanagari with English gloss; ≥ 6 testable acceptance criteria; no TBD/TODO; no contradiction with D1–D10 or docs 04/06/08
