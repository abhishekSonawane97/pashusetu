# 00 — Foundation: Vision, Locked Decisions & Glossary

| Field | Value |
|---|---|
| **Status** | Approved |
| **Version** | 1.1 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-14 |
| **Depends on** | — (root document; everything depends on this) |

> This is the single source of truth for PashuSetu. Every other document in `docs/` must be consistent with this file. If a downstream doc contradicts this file, this file wins and the downstream doc is defective.

---

## 1. Product identity

**Name:** PashuSetu (पशुसेतू — "the bridge for livestock")

**One-liner:** A trusted, Marathi-first digital livestock marketplace connecting farmers and buyers directly across rural Maharashtra.

### Vision statement
PashuSetu is a trusted digital livestock marketplace that connects farmers and buyers directly, making livestock trading transparent, accessible, and fair for rural India.

### Mission
Empower every livestock farmer with digital tools to sell animals at a fair price without depending solely on middlemen.

### Long-term vision (5 years)
Become India's largest livestock ecosystem — beyond buying and selling: veterinary services, insurance, loans, AI price estimation, transport, animal health records, and marketplace analytics.

---

## 2. Product principles (validate every decision against these)

1. **Farmer First** — when a trade-off exists between farmer convenience and anything else, the farmer wins.
2. **Trust Over Speed** — moderation before visibility; verified information over volume.
3. **Simple Enough for First-Time Smartphone Users** — icon + text pairing, minimal typing, forgiving flows.
4. **Marathi First** — Marathi is the default language everywhere; English is the fallback, never the reverse.
5. **Fast on Slow Internet** — every screen must be usable on 3G; images lazy-loaded and compressed.
6. **No Hidden Charges** — the platform is free in MVP; any future monetization is explicit and opt-in.

---

## 3. Locked decisions (user-confirmed 2026-07-04 — do NOT revisit in downstream docs)

| # | Decision | Value | Rationale (short) |
|---|---|---|---|
| D1 | Application architecture | **Next.js full-stack** — single codebase, App Router, API route handlers. No separate Express/NestJS server in MVP. | Solo developer; one deploy; extract a dedicated backend only when scale demands (revisit trigger documented in ADRs, doc 11). |
| D2 | Database | **Neon PostgreSQL** (serverless) via **Prisma ORM** | Highly relational domain (farmers→listings→breeds→districts); ACID; strong reporting. |
| D3 | Authentication | **Firebase Authentication — phone OTP**. Roles: `farmer`, `buyer`, `admin`. A user may act as both farmer and buyer with one account. *Go-live OTP channel: the SMS is sent via **Fast2SMS** (`SMS_OTP_PROVIDER=fast2sms`, `FAST2SMS_ROUTE=quick`, pre-DLT bridge), then a **Firebase custom token** mints the session — Firebase stays the identity/session layer, only the SMS delivery changed (Firebase Phone Auth's card requirement + ~₹6/OTP were unviable). `OTP_TEST_MODE` fixed code 246810 is dev/CI only. Numeric OTP rule values (10-min validity, 120s resend, 5-attempt cap) are owned by ../04-business-rules/README.md — not restated here.* | OTP is the only viable auth for the audience; avoids Aadhaar/KYC compliance burden. |
| D4 | File storage | **Supabase Storage** (S3-compatible), presigned-URL direct uploads. *(Go-live amendment 2026-07-14 — was Cloudflare R2.)* | R2 required a payment card unavailable at go-live; Supabase exposes the same S3 API, so the switch is env-only (`R2_ENDPOINT` = Supabase S3 endpoint, `R2_FORCE_PATH_STYLE=1`, real `R2_REGION`) with no code change. Local dev still uses MinIO. Bucket layout/keys unchanged — see ../09-backend/README.md §7 and ../13-deployment/README.md for deployment. |
| D5 | Hosting / CI | **Vercel** (hosting + previews) + **GitHub** + GitHub Actions (lint/typecheck/test/migrate checks). **Production is LIVE at pashusetu.online** (Vercel + Neon), go-live 2026-07. Prod DB migrations are applied MANUALLY (`prisma migrate deploy` via `DIRECT_URL`) BEFORE each code push — runbook in ../13-deployment/README.md (do not duplicate here). | Managed, free tier sufficient for MVP. |
| D6 | Buyer→seller contact (MVP) | **Click-to-call + WhatsApp deep-link only**, plus a logged **"Send Interest" event** for conversion metrics. **In-app chat is Phase 2**, not MVP. | Rural users live on calls/WhatsApp; cuts large build+moderation scope. |
| D7 | Team & sprint sizing | **Solo developer + external designer.** 2-week sprints sized for one dev. Designer works from doc 10 (design requirements), not from our sketches. | Reality of the team. |
| D8 | Language | Marathi-first UI, English fallback (i18n from day 1). All project docs in English. | Audience is rural Maharashtra. |
| D9 | Frontend platform | **PWA** (installable, offline-tolerant shell). No native app in MVP. | One codebase, instant updates, link sharing works. |
| D10 | Listing lifecycle | `DRAFT → PENDING → APPROVED → (SOLD \| REJECTED \| EXPIRED \| ARCHIVED)` — full state machine specified in doc 04. | Moderation-before-visibility is a trust cornerstone. |

## 4. MVP scope

### IN scope (MVP)
1. Phone-OTP authentication (Firebase) & session management
2. User profile (name, village/district, role flags)
3. Animal listing CRUD with photos (3–10 per listing), species, breed, age, price, milk yield, health flags, location (canonical count rule = BR-023 in ../04-business-rules/README.md; stated here only for scope-completeness).
4. Search & filters (species, breed, district, price range) with pagination
5. Listing detail page (photo carousel, all attributes, seller contact)
6. Contact seller: click-to-call, WhatsApp deep-link, "Send Interest" logged event
7. My Listings management (edit, mark sold, renew, archive)
8. Favorites (save listings)
9. Report listing (spam/fraud flag)
10. Admin moderation panel (pending queue, approve/reject with reason, user ban, audit log)
11. Notifications: SMS/basic push for listing approved/rejected, interest received
12. Marathi/English i18n

### OUT of scope (MVP) — do not design for these beyond noting extension points
Payments/escrow · delivery/transport · AI price estimation · insurance · loans · auctions · **in-app chat** · veterinary marketplace · milk tracking · Aadhaar KYC

### Success metrics (from PRD, doc 01)
- Month 1: 100 farmers registered · Month 3: 1,000 listings · Month 6: 5,000 users
- ≥25% of approved listings receive at least one inquiry (call/WhatsApp/interest event)
- Crash-free sessions ≥99%; listing page usable on 3G in <5s

---

## 5. Target users (summary — full personas in doc 03)

| User | Role | Notes |
|---|---|---|
| Livestock farmer | Primary seller | Age 25–60, Marathi-speaking, rural Maharashtra; cow/buffalo/goat/sheep |
| Livestock trader | Primary buyer | Buys in bulk, needs many listings, cross-district search |
| Dairy farm | Buyer | Seeks high milk-yield animals |
| Admin/moderator | Internal | Reviews listings, handles reports |
| Vet / transport / insurance | Future | Phase 3+; note extension points only |

---

## 6. Glossary (EN ↔ Marathi)

| English | Marathi | Definition |
|---|---|---|
| Cow | गाय (Gai) | Female bovine; primary listed species |
| Buffalo | म्हैस (Mhais) | Water buffalo |
| He-buffalo (Reda) | रेडा (Reda) | Male / draught water-buffalo; retired 2026-07 — not listable; dormant DB enum value only |
| Goat | शेळी (Sheli) | — |
| Sheep | मेंढी (Mendhi) | — |
| Bull / Ox | बैल (Bail) | Draft/breeding male |
| Calf | वासरू (Vasru) | Young bovine |
| Breed | जात (Jaat) | e.g. Gir, HF (Holstein Friesian), Jersey, Murrah, Jafarabadi, Osmanabadi |
| Milk yield | दूध उत्पादन (Dudh Utpadan) | Litres/day; key value driver for milch animals |
| Lactation | वेत (Vet) | Nth lactation cycle; affects price |
| Pregnant | गाभण (Gabhan) | Pregnancy status flag |
| Vaccinated | लसीकरण झालेले (Lasikaran) | Vaccination status flag |
| Farmer | शेतकरी (Shetkari) | Seller persona |
| Buyer | खरेदीदार (Kharedidar) | Buyer persona |
| Trader | व्यापारी (Vyapari) | Bulk buyer persona |
| Listing | जाहिरात (Jahirat) | One animal (or lot) offered for sale |
| Cattle market | बाजार / पशु मेळा (Bazar / Pashu Mela) | Traditional weekly mandi |
| District | जिल्हा (Jilha) | Admin level 2 (36 in Maharashtra) |
| Taluka | तालुका (Taluka) | Admin level 3 |
| Village | गाव (Gaon) | Free-text + Places autocomplete |
| Price | किंमत (Kimmat) | Asking price, INR |
| Sold | विकले गेले (Vikle Gele) | Terminal happy state of a listing |

**Domain terms (internal):**
- **Listing** — one sale offer for one animal (MVP: 1 animal per listing; lots are Phase 2).
- **Interest event** — a logged buyer action (call tap / WhatsApp tap / "Send Interest" button) used for the ≥25% inquiry metric.
- **Moderation** — admin review of a PENDING listing → APPROVED or REJECTED (with reason).
- **Verified seller** — Phase 2 badge; schema keeps an extension point but no MVP UI.

---

## 7. Standard document format (mandatory for every doc in `docs/`)

Every `docs/NN-*/README.md` (and per-feature files) MUST have:

1. **Header table**: Status (Draft/Review/Approved) · Version · Owner · Last updated · Depends on (links).
2. **Body** — decision-complete: no "TBD", no "to be decided", no open questions left unanswered. If a value must be chosen (e.g. max photos), choose it and state it.
3. **Acceptance checklist** (final section) — checkable boxes restating the doc's own success parameters, so each folder is trackable like a sprint sheet.

Cross-reference other docs by relative path, e.g. `../07-database/README.md`.

---

## 8. Legal & compliance guardrails (summary — full detail in doc 16)

- **No slaughter-sale facilitation**: Maharashtra Animal Preservation Act (1976, amended 2015) bans cow slaughter. Every listing requires a seller declaration; moderation rejects listings that suggest slaughter intent.
- **No Aadhaar collection/storage.** Phone OTP only.
- **IT (Intermediary Guidelines) Rules 2021** apply: grievance mechanism, content takedown, privacy policy, T&C.
- Platform is a facilitator; transactions occur offline between parties; disclaimers required.

---

## Acceptance checklist

- [x] Vision, mission, principles stated and consistent with source discussions
- [x] All 10 locked decisions recorded with rationale
- [x] MVP scope IN/OUT lists explicit and exhaustive
- [x] Success metrics quantified
- [x] EN↔Marathi glossary covers species, roles, domain terms
- [x] Standard doc format defined for all downstream docs
- [x] Legal guardrails summarized with pointer to doc 16
