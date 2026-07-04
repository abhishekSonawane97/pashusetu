# Handoff: PashuSetu — Marketplace PWA (full MVP screen inventory)

## Overview
PashuSetu (पशुसेतू) is a Marathi-first marketplace PWA where farmers in rural Maharashtra sell cows, buffaloes, bulls/oxen, goats and sheep. Sellers post via a 5-step wizard; every listing is human-moderated before going public; buyers browse without login and contact sellers by phone/WhatsApp after OTP login. Free, no payments, no chat, no auctions. This package covers **all 23 screens + 5 wizard sub-steps + 2 global states** (login wall, banned account), approved by the founder.

Authoritative requirements live in **Doc 10 — Frontend Design Requirements** (and docs 04/05/06 it freezes). Where this package and Doc 10 disagree, Doc 10 wins — file a change request, never deviate silently.

## About the Design Files
The files in `design-reference/` are **design references created in HTML** — they show intended look, states and behavior. They are NOT production code. Your task is to **recreate these designs in your target stack** using its patterns. No stack exists yet; recommendation given the PRD constraints (PWA, SSR for public pages, ≤500KB first load, ≤200KB JS on search/detail): a lightweight SSR framework (e.g. Next.js/Astro/SvelteKit) + service worker, with plain CSS custom properties from `tokens.css` (no heavy UI library).

- `design-reference/PashuSetu-Screens.html` — the full design canvas, self-contained, opens in any browser. Frames are labeled `1a…1m` (foundations, wizard, buyer core, admin review) and `2a…2q` (auth, global states, utilities, settings, admin suite), each tagged with its canonical screen id `S-01…S-23`.
- `design-reference/Dev-Handoff-Doc.html` — the detailed spec (tokens with contrast rules, component dimensions, per-screen binding rules, accessibility contract, copy deck, open items). **Read it fully before building.** Print to PDF from the browser if needed.

## Fidelity
**High-fidelity**, with three explicit placeholders (do not treat as final): species icons (grayscale glyphs — bespoke line-icon set pending field validation), all animal photos (grey slots), the WhatsApp brand glyph, and the logo/tagline slots on S-01. Everything else — colors, type, spacing, component anatomy, copy — is final pending the founder items listed in the spec's §10.

## Hard rules the implementation must never break
1. **Marathi-first**: Devanagari strings are the primary UI; English is a locale variant. Latin digits only, Indian grouping (₹1,25,000).
2. **Seller phone number is never present** in any public DOM/API response until a logged-in buyer's contact action succeeds (BR-10/BR-062).
3. **Unset optional listing fields are omitted entirely** — never rendered as "–" or "N/A".
4. The **seller declaration (BR-027)** and all canonical strings in `strings.csv` marked `doc06`/`BR-027` are verbatim — no paraphrasing, no truncation.
5. Touch targets ≥ 48×48px with ≥ 8px gaps; every icon carries a visible Marathi label; no gesture-only interactions; one filled primary action per screen.
6. Bottom navigation is exactly 4 tabs (होम / विका / आवडते / प्रोफाइल), hidden inside the wizard; max 2 levels of navigation depth.
7. Skeletons over spinners (anything >300ms); explicit image dimensions everywhere (zero CLS); no decorative imagery.
8. Nothing irreversible without a plain-Marathi confirmation naming the consequence (mark-sold, archive, logout, admin ban).

## Screens / Views
Full per-screen content checklists and state enumerations are in Doc 10 §3; the spec doc §5 lists the binding implementation rules per screen. Canvas frame map:

| Canvas id | Screen | Notes |
|---|---|---|
| 1a | Foundations | tokens, type scale, badges, controls |
| 1b–1f | S-10a…S-10e | listing wizard (autosave, quota 10, photos 1–5 ≤5MB, price words readback, verbatim declaration) |
| 1g | S-11 | seller dashboard, 7 status tabs, quota meter |
| 1h–1k | S-01, S-05, S-06, S-07 | onboarding + buyer core (filters in URL, sticky contact bar) |
| 1l–1m | S-19, S-20 | admin queue (24h SLA badges) + review/reject taxonomy |
| 2a–2e | S-02, S-03, S-04 + login wall + banned | Firebase phone OTP; wall is a cancellable sheet |
| 2f–2k | S-08, S-09, S-13, S-14, S-17, S-12 | viewer, seller sheet, favorites, notifications, report, edit |
| 2l–2m | S-15, S-16 | profile/settings, language switch |
| 2n–2q | S-18, S-21, S-22, S-23 | admin login/guard, reports, users+ban, stats/audit |

## Interactions & Behavior
- Motion: 120/180ms ease, ≤300ms on critical paths, degrade to instant on low-end devices. Hover states are pointer-only enhancements.
- OTP: 60s timer, 30s resend cooldown, 3 wrong codes invalidate; WebOTP auto-read as progressive enhancement.
- Wizard: autosave every step; back never loses data; save-and-exit always safe; resume lands on first incomplete step; offline keeps inputs locally and blocks forward navigation.
- Search: full filter state in URL (shareable, hydrate before first paint); infinite scroll 20/page; back restores scroll + filters.
- Contact: call/WhatsApp open dialer/WhatsApp AND show the number in a confirmation sheet; interest posts an event; all three login-walled and rate-limited.
- Offline: global non-dismissible banner, cached reads, writes disabled with explanation, branded offline page (never the browser default).
- PWA: installable (custom prompt from 2nd session), safe-area insets on bottom nav/contact bar, every sub-screen carries its own back affordance (no browser chrome in standalone mode).

## State Management (minimum)
Auth session (phone OTP, role flags) · profile · listing drafts with autosave + resume · listing lifecycle (DRAFT→PENDING→APPROVED→SOLD/EXPIRED/REJECTED/ARCHIVED, 30-day expiry, renew) · 10-active-listing quota · favorites (optimistic) · notifications + unread count · search filter/URL state · rate-limit responses · admin queue with 409 conflict handling · audit logging of every admin action.

## Design Tokens
`tokens.css` is the machine-readable source (colors incl. all 7 status pairs, type scale, spacing, radii, shadows, sizes, motion). Fonts: **Lato** (Latin + digits; TTFs available in the design workspace's design-system folder) + **Noto Sans Devanagari** 400/700 self-hosted WOFF2 subset ≤60KB. Devanagari line-height ≥1.6 body / ≥1.4 headings; verify no clipped matras at 130% font scale with «जिल्ह्यांमध्ये», «दुरुस्त», «म्हैस», «क्षेत्र».

## Copy
`strings.csv` — every string used in the designs: key, Marathi, English gloss, screen, source. Rows sourced `doc06`/`BR-027` are canonical and verbatim; rows marked `NEW` need founder approval before ship (treat as final wording for now).

## Assets
- `icons/` — 44 SVGs, 24px grid, stroke-based, `currentColor` (Lucide-derived per the Simplotel design system). `whatsapp-placeholder.svg` must be replaced with the licensed WhatsApp glyph.
- Species icons, logo, app icon (maskable 192/512), splash, empty-state illustrations, real photography: **not yet available** — slots are marked in the designs; will follow from the founder.

## Files
```
design_handoff_pashusetu/
├── README.md                      ← you are here
├── tokens.css                     ← CSS custom properties (source of truth for values)
├── strings.csv                    ← copy deck (Marathi/English, canonical flags)
├── icons/                         ← 44 SVG icons
└── design-reference/
    ├── PashuSetu-Screens.html     ← full design canvas (self-contained, open in browser)
    └── Dev-Handoff-Doc.html       ← detailed spec — read before building
```

## Known gaps / next design drops
Exhaustive per-state frames (skeleton/empty/offline per screen), English variants, 768/1024 responsive variants, clickable prototypes for field-testing, and the founder sign-off items (accent direction, species icons, type pairing CR-01, logo). Build against the current frames; these arrive as additive updates.
