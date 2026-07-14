# Feature: Search & Filters (F-04)

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 2.0 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-14 |
| **Depends on** | [../01-prd/README.md](../01-prd/README.md) (F-04) · [../04-business-rules/README.md](../04-business-rules/README.md) (BR-034, BR-060, BR-090 #12; canonical `Species` rule values incl. `REDA`) · [../06-user-flows/README.md](../06-user-flows/README.md) (Flow E, S-05, S-06) · [../07-database/README.md](../07-database/README.md) (DB `Species` enum + filter indexes) · [../08-api/README.md](../08-api/README.md) §4.1 (search query contract) · [listing-detail.md](listing-detail.md) |

## Purpose

The buyer-side core loop: browse and filter APPROVED listings by species, breed, district, taluka, price, age, milk yield and pregnancy — no login — plus a free-text search (गाव / जात / विक्रेता / जाहिरात-आयडी) for buyers who already know what they want. Searchability is the single biggest advantage over WhatsApp groups; URL-encoded filter state makes every result view shareable on WhatsApp itself.

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

1. **S-05** home shows species category chips (गाय / म्हैस / बैल / शेळी / मेंढी / रेडा — six), a search entry bar ("जनावर शोधा"), and the latest APPROVED listings feed. Tapping the search bar (or a chip) opens the **S-06** filter sheet as a bottom sheet **in place on the home screen** — a single tap no longer navigates to `/listings`; the sheet's "जाहिराती पहा" button then routes to the matching `/listings` results. Free-text search now ships: the sheet's top field is "शोधा" (placeholder "गाव, जात किंवा विक्रेत्याचे नाव").
2. **S-06** renders results from `GET /listings` (default sort `newest`, 20 per page). Each card: cover WebP thumbnail, species icon, breed name (Marathi in MR mode), price with Indian grouping (₹65,000, Latin digits), age, district, and a "गाभण" (pregnant) badge when `isPregnant = true`.
3. The **filters bottom sheet** offers, in order: (1) free-text "शोधा" field; (2) species single-select chips (six, incl. रेडा); (3) breed picker — shown only once a species is chosen, "सर्व जाती" default, via `GET /meta/breeds?species=`; (4) district picker ("सर्व जिल्हे"); (5) taluka picker dependent on district ("सर्व तालुके", via `GET /meta/talukas?districtId=`); (6) min/max price; (7) min/max age in months ("किमान वय (महिने)" / "जास्तीत जास्त वय"); (8) min milk "किमान दूध (लि/दिवस)"; (9) pregnant-only checkbox "फक्त गाभण जनावरे"; (10) sort "क्रमवारी" (नवीन आधी / कमी किंमत आधी / जास्त किंमत आधी = `newest` | `price_asc` | `price_desc`). The primary Apply button is "जाहिराती पहा"; a second ghost button "सर्व काढा" (clear-all) resets to `/listings`. Applying pushes the URL params, closes the sheet, renders removable filter chips above the results, and re-queries.
4. Filter + sort state mirrors into the URL query (`/listings?q=&species=&breedId=&districtId=&taluka=&minPrice=&maxPrice=&minMilk=&minAge=&maxAge=&isPregnant=1&sort=`); only non-default keys are written (`sort` omitted when `newest`; `isPregnant` only ever `1`). Opening a shared URL hydrates the sheet and chips before the first fetch and server-side renders the same results (NFR-09) — behaviour unchanged, the param list simply grew.
5. **Infinite scroll:** the next cursor page loads automatically ≥ 300 px before list end; a card skeleton row shows while loading; exhaustion renders the terminal row "सर्व जाहिराती पाहिल्या" (you have seen all listings).
6. **Sticky results header:** the S-06 results screen carries a sticky `top-0` header (back control + "जाहिराती" title + "फिल्टर" button). When any filter is active it shows (a) an active-filter **count badge** on the "फिल्टर" button and (b) a one-tap "सर्व काढा" (clear-all) that resets to `/listings`. Active count = number of set keys among `q`, `species`, `breedId`, `districtId`, `taluka`, `minPrice`, `maxPrice`, `minMilk`, `minAge`, `maxAge`, `isPregnant`, plus 1 when `sort` ≠ `newest`.
7. Tapping a card → **S-07** ([listing-detail.md](listing-detail.md)); back-navigation restores filters and scroll position exactly (critical on 3G, principle 5).
8. Empty results (filtered): "या शोधाशी जुळणारे जनावर सापडले नाही. फिल्टर बदला किंवा काढा." (Nothing matched this search. Change or clear the filters.) with the one-tap reset "फिल्टर काढा" (remove filters). The non-filtered home / nearby empty states ("तुमच्या जिल्ह्यात अजून जनावरे नाहीत" etc.) are owned by the browse/find feed doc — cross-ref only.

## Fields & validation

| Field | Type | Required | Validation rule | Error message EN | Error message MR |
|---|---|---|---|---|---|
| species | enum | No | `COW\|BUFFALO\|BULL_OX\|GOAT\|SHEEP\|REDA` (रेडा / he-buffalo). Local copy for the filter form — canonical enum owner is [doc 04](../04-business-rules/README.md) (rule values) + DB `Species` in [doc 07](../07-database/README.md) | Invalid animal type | चुकीचा जनावराचा प्रकार |
| breedId | string (cuid) | No | Must exist and match `species` when both set; server rejects mismatch | This breed does not match the animal type | ही जात या जनावराशी जुळत नाही |
| districtId | string (cuid) | No | One of 36 seeded districts | Invalid district | चुकीचा जिल्हा |
| minPrice | integer | No | ≥ 0; `minPrice ≤ maxPrice` when both set (Apply blocked client-side) | Minimum price cannot exceed maximum price | किमान किंमत जास्तीत जास्त किंमतीपेक्षा कमी हवी |
| maxPrice | integer | No | ≥ 0 | Enter a valid price | बरोबर किंमत टाका |
| sort | enum | No | `newest` (default) \| `price_asc` \| `price_desc` | — (client sends only valid values) | — |
| cursor | opaque string | No | Server-issued; invalid/expired → 400, client silently restarts from page 1 | — (never user-visible) | — |
| limit | integer | No | Default 20, min 1, max 50 — `limit` > 50 or < 1 → 422 `VALIDATION_ERROR` (BR-090 #12, doc 08 §1.4) | — | — |
| q | string | No | Trimmed, length 1..60; free text (village / breed / seller / listing id) | — | — |
| taluka | string | No | Free-text tehsil, length 1..60 | — | — |
| minMilk | number | No | 0..60 (L/day) | — | — |
| minAge | integer (months) | No | 1..300; `minAge ≤ maxAge` when both set (Apply blocked client-side) | Minimum age cannot exceed maximum age | किमान वय जास्तीत जास्त वयापेक्षा कमी हवे |
| maxAge | integer (months) | No | 1..300 | — | — |
| isPregnant | enum | No | Only value `1` = show pregnant animals only | — | — |

The server param contract and types for these fields are owned by [doc 08](../08-api/README.md) §4.1. Server violations → 400/422 `VALIDATION_ERROR` per doc 08 §1.3; the client's guards mean users never see these — a manipulated URL resets to the default search rather than crashing (PRD F-04 edge).

## Business logic

- Only APPROVED listings are returned; keyset cursor pagination (`approved_at, id`) tolerates listings entering/leaving between pages — no duplicates or skips — BR-034, BR-090 #12, PRD FR-06.
- Public, cookie-free, login-free — BR-060; results pages are SSR for SEO and WhatsApp previews (NFR-09).
- Changing species clears an incompatible breed filter client-side; the server independently rejects mismatched `breedId`/`species` pairs (PRD F-04 AC-3).
- Rapid filter changes: in-flight request aborted and replaced (300 ms debounce) so results never render out of order (PRD F-04 edge).
- Card prices always render Latin digits with Indian grouping in both locales (PRD F-12 AC-6); long breed names truncate with ellipsis on cards (full name on S-07).
- p95 search latency budget ≤ 500 ms server-side (NFR-03); indexes in [../07-database/README.md](../07-database/README.md).
- Free-text `q` matches case-insensitive `contains` on `village`, `taluka`, `breed.nameMr`, `breed.nameEn` and `seller.name`, OR an exact `id` equality (a pasted id / shared link) — combined as one OR-group. `q` and the keyset cursor are each OR-groups AND-ed together (never a single top-level `OR`) so neither clobbers the other.
- `minMilk` filters `milkYieldLpd >= value`; `minAge`/`maxAge` filter `ageMonths` (`gte`/`lte`); `isPregnant = '1'` filters `isPregnant = true`. All filters combine with AND. SQL/index ownership stays in [doc 07](../07-database/README.md); the endpoint contract in [doc 08](../08-api/README.md).

## API usage

| Method + path | When |
|---|---|
| `GET /api/v1/listings` | Initial load, every filter/sort apply, every cursor page (params: `q`, `species`, `breedId`, `districtId`, `taluka`, `minPrice`, `maxPrice`, `minMilk`, `minAge`, `maxAge`, `isPregnant`, `sort`, `cursor`, `limit`) |
| `GET /api/v1/meta/breeds?species=` | When a species is selected in the filter sheet (and on species change) |
| `GET /api/v1/meta/districts` | Filter sheet first open (cached for the session) |
| `GET /api/v1/meta/talukas?districtId=` | When the district changes in the filter sheet (talukas depend on district) |

Each endpoint's request/response contract (and its 422 `VALIDATION_ERROR` codes) is owned by [doc 08](../08-api/README.md) §4.

## States

| State | What the user sees |
|---|---|
| Loading | First load: full card-skeleton grid (never spinner-only, NFR-01); pagination: one skeleton row appended; filter re-query: skeletons replace results while chips stay visible. |
| Empty | Filtered: "या शोधाशी जुळणारे जनावर सापडले नाही. फिल्टर बदला किंवा काढा." + "फिल्टर काढा" reset CTA. Never a bare blank list. (Non-filtered home/nearby empty states owned by the browse/find feed doc.) |
| Error | Network failure mid-scroll: inline offline row with "पुन्हा प्रयत्न करा" (retry) appended — already-loaded cards stay rendered. First-load failure: full-screen retry state. Invalid cursor: silent restart from page 1. |
| Success | Cards render 20/page; applied filters show as removable chips; URL reflects state; end-of-results terminal row on exhaustion. |
| Edge | **Listing sold/expired after the page cached:** the card still shows; S-07 handles the truth (404 → unavailable state). **min > max price:** Apply blocked with the inline error under the price fields. **Species changed after breed picked:** breed resets and re-fetches. **Manipulated URL params:** server 400s, client resets to default search. **Back from S-07:** filters + scroll position restored. |

## Analytics

| Event | Fired when | Properties |
|---|---|---|
| `search_performed` | Every `GET /listings` triggered by a user action (initial view, filter apply, sort change — not pagination) | `species`, `districtId`, `sort`, `hasPriceFilter` (boolean), `resultCountBucket` (`0`, `1-20`, `21+`) |
| `filter_applied` | Filter sheet Apply tap | `filtersSet` (array of filter names set), `sort` |

## Acceptance criteria

1. `GET /listings` accepts `q`, `species`, `breedId`, `districtId`, `taluka`, `minPrice`, `maxPrice`, `minMilk`, `minAge`, `maxAge`, `isPregnant`, `sort` (`newest` default, `price_asc`, `price_desc`), `cursor`, `limit`; returns only APPROVED listings, default 20 per page, max 50 (`limit` > 50 or < 1 → 422 `VALIDATION_ERROR`, BR-090 #12), with opaque `nextCursor` (null on last page).
2. Result cards show cover thumbnail, species icon, breed (localized), price as "₹65,000"-style Latin digits with Indian grouping, age, district, and the गाभण badge when applicable.
3. Selecting a species restricts the breed picker to that species; changing species clears an incompatible breed filter; a mismatched `breedId` sent anyway returns 400 `VALIDATION_ERROR`.
4. `minPrice > maxPrice` blocks Apply client-side with the inline MR error; manipulated URLs with invalid params cause a server 400 and a client reset to the default search — never a crash.
5. Filter and sort state round-trips through the URL: opening a shared `/listings?…` URL server-renders the identical result view and hydrates chips + sheet.
6. Infinite scroll fetches the next page ≥ 300 px before the end, shows a skeleton row, and renders "सर्व जाहिराती पाहिल्या" at exhaustion; a network drop appends an inline retry row without discarding loaded cards.
7. Zero results renders the canonical empty state with a working one-tap "फिल्टर काढा" that clears every filter and re-queries.
8. Back-navigation from S-07 restores both the applied filters and the scroll position; rapid filter changes never flash stale results (in-flight request aborted, 300 ms debounce).
9. Free-text `q` returns APPROVED listings whose `village`, `taluka`, `breed` name (Marathi + English) or seller name contains `q` (case-insensitive), OR whose `id` exactly equals `q`.
10. `minMilk`, `minAge`/`maxAge` and `isPregnant = '1'` each further restrict results and combine with every other filter via AND; `minAge > maxAge` blocks Apply client-side with the inline MR error.
11. Whenever ≥ 1 filter is set, the sticky results header shows an active-filter count badge on the "फिल्टर" button and a one-tap "सर्व काढा" — both clearing to `/listings`.
12. Tapping the home S-05 search bar opens the filter sheet in place (no navigation) and its "जाहिराती पहा" button routes to the matching `/listings` results.

## Out of scope

- Radius/nearby geolocation search, saved searches with alerts, district price stats — Phase 2/3 (PRD F-04 future improvements).
- Filtering by any non-APPROVED status — public search shows live listings only (BR-034).

## Acceptance checklist

- [x] All mandatory sections present in order, ending with this checklist per foundation §7; no TBD
- [x] Only APPROVED listings returned (BR-034); public, anonymous, cookie-free access (BR-060); only canonical `/api/v1` paths referenced (`GET /listings`, `GET /meta/breeds`, `GET /meta/districts`, `GET /meta/talukas`)
- [x] Pagination matches BR-090 #12 and doc 08 §1.4: default 20, min 1, max 50, `limit` > 50 or < 1 → 422 `VALIDATION_ERROR`; opaque server-issued cursor, invalid cursor → 400 with silent restart from page 1
- [x] Enums match owner docs: species `COW|BUFFALO|BULL_OX|GOAT|SHEEP|REDA`, sort `newest|price_asc|price_desc`; server rejects mismatched `breedId`/`species` pairs
- [x] Screens cited as S-05/S-06/S-07 per doc 06 Flow E; URL round-trip and SSR per NFR-09; p95 search latency ≤ 500 ms per NFR-03
- [x] Analytics limited to the frozen `search_performed` and `filter_applied` events; Marathi strings are Devanagari with English gloss
- [x] ≥ 6 testable acceptance criteria; all five states (loading/empty/error/success/edge) defined; free-text `q`, milk-yield and age-range filters are in scope and specified; radius/nearby and saved searches remain out of scope
