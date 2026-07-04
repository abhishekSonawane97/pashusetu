# Feature: Search & Filters (F-04)

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 1.0 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-04 |
| **Depends on** | [../01-prd/README.md](../01-prd/README.md) (F-04) · [../04-business-rules/README.md](../04-business-rules/README.md) (BR-034, BR-060, BR-090 #12) · [../06-user-flows/README.md](../06-user-flows/README.md) (Flow E, S-05, S-06) · [listing-detail.md](listing-detail.md) |

## Purpose

The buyer-side core loop: browse and filter APPROVED listings by species, breed, district, and price — no login, no typing beyond price digits. Searchability is the single biggest advantage over WhatsApp groups; URL-encoded filter state makes every result view shareable on WhatsApp itself.

## User stories

- As a **trader**, I want to filter animals by species, breed, district and price so I can shortlist ten candidate cows across three districts without traveling.
- As a **dairy-farm buyer**, I want to sort by price so I can see whether high yield justifies the asking prices.
- As a **visitor with a shared link**, I want the exact same filtered results the sender saw, without installing or logging in.

## Preconditions & permissions

| Aspect | Value |
|---|---|
| Who | Everyone — anonymous included (BR-060) |
| Login required | No. Contact/favorite from result cards raise the login wall downstream ([contact-seller.md](contact-seller.md), [favorites.md](favorites.md)) |
| Role | None |
| Data visibility | Only APPROVED listings ever appear (BR-034) |

## UX workflow

1. **S-05** home shows species category chips (गाय / म्हैस / बैल / शेळी / मेंढी), a search entry bar, and the latest APPROVED listings feed. Tapping a chip or the search bar opens **S-06** (the bar is a shortcut into the S-06 filter sheet — MVP has **no free-text keyword search**; see Out of scope).
2. **S-06** renders results from `GET /listings` (default sort `newest`, 20 per page). Each card: cover WebP thumbnail, species icon, breed name (Marathi in MR mode), price with Indian grouping (₹65,000, Latin digits), age, district, and a "गाभण" (pregnant) badge when `isPregnant = true`.
3. The **filters bottom sheet** offers: species (single-select chips), breed (picker filtered by species via `GET /meta/breeds?species=`), district (36-district picker), min/max price inputs, and sort (नवीन आधी / किंमत कमी → जास्त / किंमत जास्त → कमी = `newest` | `price_asc` | `price_desc`). Applying closes the sheet, renders removable filter chips above the results, and re-queries.
4. Filter + sort state mirrors into the URL query (`/listings?species=&breedId=&districtId=&minPrice=&maxPrice=&sort=`); opening a shared URL hydrates the sheet and chips before the first fetch and server-side renders the same results (NFR-09).
5. **Infinite scroll:** the next cursor page loads automatically ≥ 300 px before list end; a card skeleton row shows while loading; exhaustion renders the terminal row "सर्व जाहिराती पाहिल्या" (you have seen all listings).
6. Tapping a card → **S-07** ([listing-detail.md](listing-detail.md)); back-navigation restores filters and scroll position exactly (critical on 3G, principle 5).
7. Empty results: "काहीही सापडले नाही. फिल्टर बदलून पुन्हा पहा." (Nothing found. Change the filters and look again.) with the one-tap reset "फिल्टर काढा" (remove filters) and a change-filters CTA reopening the sheet.

## Fields & validation

| Field | Type | Required | Validation rule | Error message EN | Error message MR |
|---|---|---|---|---|---|
| species | enum | No | `COW\|BUFFALO\|BULL_OX\|GOAT\|SHEEP` | Invalid animal type | चुकीचा जनावराचा प्रकार |
| breedId | string (cuid) | No | Must exist and match `species` when both set; server rejects mismatch | This breed does not match the animal type | ही जात या जनावराशी जुळत नाही |
| districtId | string (cuid) | No | One of 36 seeded districts | Invalid district | चुकीचा जिल्हा |
| minPrice | integer | No | ≥ 0; `minPrice ≤ maxPrice` when both set (Apply blocked client-side) | Minimum price cannot exceed maximum price | किमान किंमत कमाल किंमतीपेक्षा जास्त असू शकत नाही |
| maxPrice | integer | No | ≥ 0 | Enter a valid price | बरोबर किंमत टाका |
| sort | enum | No | `newest` (default) \| `price_asc` \| `price_desc` | — (client sends only valid values) | — |
| cursor | opaque string | No | Server-issued; invalid/expired → 400, client silently restarts from page 1 | — (never user-visible) | — |
| limit | integer | No | Default 20, min 1, max 50 — `limit` > 50 or < 1 → 422 `VALIDATION_ERROR` (BR-090 #12, doc 08 §1.4) | — | — |

Server violations → 400/422 `VALIDATION_ERROR` per doc 08 §1.3; the client's guards mean users never see these — a manipulated URL resets to the default search rather than crashing (PRD F-04 edge).

## Business logic

- Only APPROVED listings are returned; keyset cursor pagination (`approved_at, id`) tolerates listings entering/leaving between pages — no duplicates or skips — BR-034, BR-090 #12, PRD FR-06.
- Public, cookie-free, login-free — BR-060; results pages are SSR for SEO and WhatsApp previews (NFR-09).
- Changing species clears an incompatible breed filter client-side; the server independently rejects mismatched `breedId`/`species` pairs (PRD F-04 AC-3).
- Rapid filter changes: in-flight request aborted and replaced (300 ms debounce) so results never render out of order (PRD F-04 edge).
- Card prices always render Latin digits with Indian grouping in both locales (PRD F-12 AC-6); long breed names truncate with ellipsis on cards (full name on S-07).
- p95 search latency budget ≤ 500 ms server-side (NFR-03); indexes in [../07-database/README.md](../07-database/README.md).

## API usage

| Method + path | When |
|---|---|
| `GET /api/v1/listings` | Initial load, every filter/sort apply, every cursor page (params: `species`, `breedId`, `districtId`, `minPrice`, `maxPrice`, `sort`, `cursor`) |
| `GET /api/v1/meta/breeds?species=` | When a species is selected in the filter sheet (and on species change) |
| `GET /api/v1/meta/districts` | Filter sheet first open (cached for the session) |

## States

| State | What the user sees |
|---|---|
| Loading | First load: full card-skeleton grid (never spinner-only, NFR-01); pagination: one skeleton row appended; filter re-query: skeletons replace results while chips stay visible. |
| Empty | "काहीही सापडले नाही. फिल्टर बदलून पुन्हा पहा." + "फिल्टर काढा" reset CTA + change-filters CTA. Never a bare blank list. |
| Error | Network failure mid-scroll: inline offline row with "पुन्हा प्रयत्न करा" (retry) appended — already-loaded cards stay rendered. First-load failure: full-screen retry state. Invalid cursor: silent restart from page 1. |
| Success | Cards render 20/page; applied filters show as removable chips; URL reflects state; end-of-results terminal row on exhaustion. |
| Edge | **Listing sold/expired after the page cached:** the card still shows; S-07 handles the truth (404 → unavailable state). **min > max price:** Apply blocked with the inline error under the price fields. **Species changed after breed picked:** breed resets and re-fetches. **Manipulated URL params:** server 400s, client resets to default search. **Back from S-07:** filters + scroll position restored. |

## Analytics

| Event | Fired when | Properties |
|---|---|---|
| `search_performed` | Every `GET /listings` triggered by a user action (initial view, filter apply, sort change — not pagination) | `species`, `districtId`, `sort`, `hasPriceFilter` (boolean), `resultCountBucket` (`0`, `1-20`, `21+`) |
| `filter_applied` | Filter sheet Apply tap | `filtersSet` (array of filter names set), `sort` |

## Acceptance criteria

1. `GET /listings` accepts exactly `species`, `breedId`, `districtId`, `minPrice`, `maxPrice`, `sort` (`newest` default, `price_asc`, `price_desc`), `cursor`, `limit`; returns only APPROVED listings, default 20 per page, max 50 (`limit` > 50 or < 1 → 422 `VALIDATION_ERROR`, BR-090 #12), with opaque `nextCursor` (null on last page).
2. Result cards show cover thumbnail, species icon, breed (localized), price as "₹65,000"-style Latin digits with Indian grouping, age, district, and the गाभण badge when applicable.
3. Selecting a species restricts the breed picker to that species; changing species clears an incompatible breed filter; a mismatched `breedId` sent anyway returns 400 `VALIDATION_ERROR`.
4. `minPrice > maxPrice` blocks Apply client-side with the inline MR error; manipulated URLs with invalid params cause a server 400 and a client reset to the default search — never a crash.
5. Filter and sort state round-trips through the URL: opening a shared `/listings?…` URL server-renders the identical result view and hydrates chips + sheet.
6. Infinite scroll fetches the next page ≥ 300 px before the end, shows a skeleton row, and renders "सर्व जाहिराती पाहिल्या" at exhaustion; a network drop appends an inline retry row without discarding loaded cards.
7. Zero results renders the canonical empty state with a working one-tap "फिल्टर काढा" that clears every filter and re-queries.
8. Back-navigation from S-07 restores both the applied filters and the scroll position; rapid filter changes never flash stale results (in-flight request aborted, 300 ms debounce).

## Out of scope

- **Free-text keyword search** (`q`): not in MVP — the canonical `GET /listings` has no text parameter; the S-05 search bar is a shortcut into the structured filter sheet. Text search on descriptions is a PRD F-04 future improvement.
- Radius/nearby geolocation search, saved searches with alerts, milk-yield and age range filters, district price stats — Phase 2/3 (PRD F-04 future improvements).
- Filtering by any non-APPROVED status — public search shows live listings only (BR-034).

## Acceptance checklist

- [x] All mandatory sections present in order, ending with this checklist per foundation §7; no TBD
- [x] Only APPROVED listings returned (BR-034); public, anonymous, cookie-free access (BR-060); only canonical `/api/v1` paths referenced (`GET /listings`, `GET /meta/breeds`, `GET /meta/districts`)
- [x] Pagination matches BR-090 #12 and doc 08 §1.4: default 20, min 1, max 50, `limit` > 50 or < 1 → 422 `VALIDATION_ERROR`; opaque server-issued cursor, invalid cursor → 400 with silent restart from page 1
- [x] Enums match owner docs: species `COW|BUFFALO|BULL_OX|GOAT|SHEEP`, sort `newest|price_asc|price_desc`; server rejects mismatched `breedId`/`species` pairs
- [x] Screens cited as S-05/S-06/S-07 per doc 06 Flow E; URL round-trip and SSR per NFR-09; p95 search latency ≤ 500 ms per NFR-03
- [x] Analytics limited to the frozen `search_performed` and `filter_applied` events; Marathi strings are Devanagari with English gloss
- [x] ≥ 6 testable acceptance criteria; all five states (loading/empty/error/success/edge) defined; free-text keyword search explicitly out of scope
