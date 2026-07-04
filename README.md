# PashuSetu — पशुसेतू

> A trusted, **Marathi-first** digital livestock marketplace connecting farmers and buyers directly across rural Maharashtra. Farmers list animals; buyers search, filter and contact sellers; every listing is admin-moderated before going public.

**Stack (locked):** Next.js full-stack (App Router) · Prisma + Neon PostgreSQL · Firebase Auth (phone OTP) · Cloudflare R2 · Vercel + GitHub Actions · PWA
**Team:** Solo developer + external designer · 2-week sprints · 8 sprints to beta pilot

This repository currently contains the complete **Phase 1 blueprint** — every product, engineering, design, and operations decision documented before the first line of application code. The application will be built in this same repo per the [project plan](docs/15-project-plan/README.md).

---

## Documentation map

| #   | Area                | Main doc                                                                                | What it owns                                                                                                         |
| --- | ------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 00  | Foundation          | [docs/00-foundation/](docs/00-foundation/README.md)                                     | Vision, locked decisions D1–D10, MVP scope, glossary, doc format. **Overrides everything.**                          |
| 01  | PRD                 | [docs/01-prd/](docs/01-prd/README.md)                                                   | Features F-01..F-12 with acceptance criteria, FR/NFR budgets, success metrics, release gate                          |
| 02  | Research            | [docs/02-research/](docs/02-research/README.md)                                         | Market data, competitor matrix, gap analysis, go-to-market plan (raw sources in [source/](docs/02-research/source/)) |
| 03  | Users               | [docs/03-users/](docs/03-users/README.md)                                               | Personas P1–P6, journey maps, interview templates (MR+EN), field research plan                                       |
| 04  | Business rules      | [docs/04-business-rules/](docs/04-business-rules/README.md)                             | **All rule values (BR-xxx)** + listing state machine. Rules owner — other docs cite it                               |
| 05  | Features            | [docs/05-features/](docs/05-features/README.md)                                         | 12 build-level feature specs (one file each)                                                                         |
| 06  | User flows          | [docs/06-user-flows/](docs/06-user-flows/README.md)                                     | **Screen inventory S-01..S-23**, 7 flows, navigation map, canonical Marathi microcopy                                |
| 07  | Database            | [docs/07-database/](docs/07-database/README.md)                                         | **Prisma schema**, ERD, indexes, seed data (36 districts + breeds), migration strategy                               |
| 08  | API                 | [docs/08-api/](docs/08-api/README.md)                                                   | **Full /api/v1 contract** — every endpoint, request/response, errors, rate limits                                    |
| 09  | Backend             | [docs/09-backend/](docs/09-backend/README.md)                                           | Code-level design: repo layout, layering, auth middleware, R2 pipeline, jobs, env vars                               |
| 10  | Design requirements | [docs/10-frontend-design-requirements/](docs/10-frontend-design-requirements/README.md) | **Designer handoff** — per-screen requirements, component library, tokens, deliverables                              |
| 11  | Architecture        | [docs/11-architecture/](docs/11-architecture/README.md)                                 | C4 diagrams, sequence flows, ADR-001..010, scaling path, cost model                                                  |
| 12  | Security            | [docs/12-security/](docs/12-security/README.md)                                         | Threat model, authz matrix per endpoint, upload security, OWASP mapping, incident response                           |
| 13  | Deployment          | [docs/13-deployment/](docs/13-deployment/README.md)                                     | Environment matrix, provisioning runbooks, CI/CD, secrets, rollback, monitoring, launch checklist                    |
| 14  | Testing & QA        | [docs/14-testing-qa/](docs/14-testing-qa/README.md)                                     | Test pyramid, E2E catalog, performance/Marathi/PWA checks, UAT script, release gates                                 |
| 15  | Project plan        | [docs/15-project-plan/](docs/15-project-plan/README.md)                                 | Epics → stories (PS-xxx) → 8 sprints, milestones M1–M5, risk register, Phase 2 backlog                               |
| 16  | Legal               | [docs/16-legal/](docs/16-legal/README.md)                                               | Compliance register, seller declaration, privacy/T&C outlines, grievance mechanism (draft — for counsel review)      |

**Conflict rule:** if two docs disagree, the owner doc (bold above) wins; [foundation](docs/00-foundation/README.md) wins over everything. Every doc ends with its own acceptance checklist.

## Status tracker

| Deliverable                                                                       | Status                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------ |
| All 17 doc areas written (34 markdown files)                                      | ✅ Complete                                |
| Cross-doc adversarial consistency verification (Wave 4)                           | ✅ Complete                                |
| Pilot districts (founder decision 2026-07-05)                                     | ✅ Chhatrapati Sambhajinagar + Ahilyanagar |
| Founder approval of product direction                                             | 🔄 PRD approved; docs 02–16 approval pass pending |
| Designer kickoff (send doc 10)                                                    | ✅ Handed off 2026-07-05; first delivery expected |
| Field research (20 interviews, doc 03 plan)                                       | ☐ Pending — parallel to Sprint 1           |
| External long-poles: MSG91 DLT registration, Firebase/Neon/R2/Vercel provisioning | ☐ Pending — start now (DLT is the long pole) |
| Sprint 1: walking skeleton                                                        | 🔄 In progress — PS-001 repo scaffold done |

## Development

App code lives at the repo root (single Next.js codebase per [D1](docs/00-foundation/README.md); layout per [doc 09 §1](docs/09-backend/README.md)).

```bash
pnpm install          # Node 20+, pnpm 9
cp .env.example .env.local   # fill values per docs/13 runbooks
pnpm dev              # local dev server
pnpm lint && pnpm typecheck && pnpm build   # the PR gate (CI runs the same, PS-002)
pnpm format           # Prettier — formatting is Prettier's job, ESLint checks correctness only
```

Conventions: TypeScript strict · App Router (RSC by default, client islands only where interactive) · route handlers under `app/api/v1/` mirror [doc 08](docs/08-api/README.md) exactly · business logic in `lib/services/`, DB access only in `lib/repositories/` ([doc 09 §2](docs/09-backend/README.md)) · Marathi-first UI (`lang="mr"`, Noto Sans Devanagari) · no `dangerouslySetInnerHTML` for user content (ESLint-enforced, [doc 12 §8.3](docs/12-security/README.md)).

## Reading order

- **New team member:** 00 → 01 → 04 → 06 → 05 → then your specialty (07/08/09 backend · 10 design · 13/14 ops/QA)
- **The designer:** just [doc 10](docs/10-frontend-design-requirements/README.md) — it is self-sufficient by design (personas, constraints, all 23 screens, deliverables + acceptance criteria)
- **Developer starting Sprint 1:** [15 (sprint plan)](docs/15-project-plan/README.md) → [09 (backend design)](docs/09-backend/README.md) → [07 (schema)](docs/07-database/README.md) → [08 (API)](docs/08-api/README.md) → [13 (provisioning runbooks)](docs/13-deployment/README.md)
- **Investor / partner:** 00 → [02 (market + GTM)](docs/02-research/README.md) → [11 §7 (cost model)](docs/11-architecture/README.md)

## MVP scope in one glance

**IN:** phone-OTP auth · profiles · listing CRUD + photos (moderated: `DRAFT → PENDING → APPROVED → SOLD/REJECTED/EXPIRED/ARCHIVED`) · public search + filters · listing detail · contact via call/WhatsApp + logged interest · favorites · reporting · admin moderation panel · SMS + in-app notifications · Marathi/English i18n · PWA

**OUT (Phase 2+):** payments · transport · AI pricing · insurance · loans · auctions · in-app chat · vet marketplace · milk tracking

---

_Phase 1 documentation generated 2026-07-04. Owner: Founder (Abhishek)._
