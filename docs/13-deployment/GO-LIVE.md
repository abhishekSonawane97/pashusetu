# PashuSetu — Go-Live Checklist

> **Status:** In progress · **Owner:** Abhishek · **Depends on:** [13-deployment/README.md](./README.md) (runbooks), [12-security](../12-security/README.md), [16-legal](../16-legal/README.md)
>
> Work top-to-bottom. Everything here is **config/ops** unless marked `[code]`. Tick each box; nothing ships to real users until §11 is green.

### Progress snapshot (2026-07-12)

**Done (code, on `main`):** full create → approve → browse → **contact** loop (call/WhatsApp/interest, phone reveal); **image storage on Supabase** (S3-compatible, verified end-to-end with real photos); **error monitoring** wired (dependency-free, DSN-gated); SEO/PWA; dead nav links removed (favorites tab + notifications bell hidden until built).

**Remaining = mostly your accounts + the launch gate.** Critical path: **(1)** provision accounts (domain, Firebase Blaze, Vercel, Sentry DSN, Neon prod) → **(2)** deploy to staging → **(3)** full E2E on real infra (§11) → **(4)** flip live.

---

## 0. Scope decision — DECIDED

Pilot ships the **current loop**: browse → contact seller → sell (wizard) → admin moderate.

- [x] **Contact-seller** (call/WhatsApp + interest, API-21) — **built + verified**.
- [x] **Favorites / Report / Notifications** — **deferred** post-launch; their nav entry points are hidden so nothing 404s.
- [x] Admin surface = **moderation queue only** (Reports/Users/Stats dashboards deferred).
- [ ] **Launch content (decided: keep demo listings for now).** ⚠️ **Demo listings use stock photos + seed sellers with fake phones — the contact action would reveal a fake number to real buyers. These MUST be cleared (or replaced with genuine listings) before the PUBLIC flip.** Fine for staging/private testing only.

---

## 1. Accounts & billing
- [ ] Neon project on a paid tier sized for the pilot (or confirm free tier headroom).
- [ ] Cloudflare account with R2 enabled (billing added).
- [ ] Firebase project on the **Blaze (pay-as-you-go) plan** — Phone Auth SMS will **not** send in production on the free Spark plan (~10 SMS/day cap).
- [ ] Vercel project (Pro if you need the bandwidth/analytics).
- [ ] Domain registered; DNS managed (Cloudflare or registrar).

## 2. Database — Neon (production)
- [ ] Create the production branch/DB; get pooled `DATABASE_URL` + direct `DIRECT_URL`.
- [ ] `pnpm prisma migrate deploy` against prod (applies migrations, no dev reset).
- [ ] `pnpm prisma db seed` against prod (districts + breeds + System user only). **Do NOT run `scripts/seed-demo-listings.ts` on prod** — that's dev demo data.
- [ ] Confirm connection pooling limits vs. Vercel serverless concurrency.
- [ ] Enable automated backups / PITR; note the restore runbook.

## 3. Storage — Supabase (DONE) → R2 later
Storage runs on **Supabase Storage** (S3-compatible, free, no card). The app is provider-agnostic via the `R2_*` env vars, so **Supabase → Cloudflare R2 later is an env change, no code**. `[code ✓ — verified end-to-end on live Supabase]`
- [x] Buckets `pashusetu-uploads` (private) + `pashusetu-public` (public) created; S3 keys issued.
- [x] Env set in `.env.local` (Supabase project `tlchlxkeifakrifbwlyl`, `ap-south-1`): `R2_ENDPOINT`, `R2_REGION=ap-south-1`, `R2_FORCE_PATH_STYLE=1`, `R2_BUCKET=pashusetu` (prefix), `R2_PUBLIC_BASE_URL=https://<ref>.supabase.co/storage/v1/object/public/pashusetu-public`. **These same vars must be set in Vercel prod.**
- [x] Listing photos served **directly from the storage CDN** (`unoptimized`) — pipeline pre-generates thumb/card/detail WebP variants, so no metered image optimization. `remotePatterns`/CSP derive the host from `R2_PUBLIC_BASE_URL`. `[code ✓]`
- [ ] **Confirm CORS for the real browser upload** — the pipeline test used Node (no CORS); when a real seller uploads through the wizard, the presigned `PUT` needs the Supabase Storage CORS to allow the app origin. Verify during the §11 E2E; fix in Supabase Storage settings if it fails.
- [ ] *(Later, when you have a card)* graduate to **R2** for zero egress fees + Cloudflare CDN: create R2 buckets, point the same `R2_*` vars at R2, unset `R2_FORCE_PATH_STYLE`, re-run `scripts/seed-demo-listings.ts` to move bytes. No code change.

## 3b. Error monitoring — Sentry (code DONE, needs your DSN)
- [x] Dependency-free, DSN-gated reporter wired (server `withRoute` + `instrumentation.ts`; client `global-error.tsx` + window listeners); PII-scrubbed (BR-066). `[code ✓]`
- [ ] **You:** create a Sentry project → set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel → confirm a test error lands.

## 4. Firebase Auth — production OTP (the "default OTP" fix)
- [ ] **Do NOT set `NEXT_PUBLIC_FIREBASE_TEST_MODE`** in the Vercel prod env → real reCAPTCHA is enforced. `[code ✓ — gated on this var]`
- [ ] **Remove the test phone number** (`+91 7700000001 / 731942`) — Firebase Console → Authentication → Sign-in method → Phone → "Phone numbers for testing". It's a Console setting, so it works in prod too (a known-code backdoor) until deleted.
- [ ] Add the **production domain** to Firebase Auth → Settings → **Authorized domains** (else reCAPTCHA/phone-auth won't run there).
- [ ] Confirm the **SMS region policy** allows India only (cost/abuse control).
- [ ] Enable **App Check** (reCAPTCHA Enterprise) + Firebase's **SMS toll-fraud protection** — OTP-pumping is the #1 phone-auth abuse/cost risk.
- [ ] Verify the prod Firebase Admin SDK creds (`FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`) are set as Vercel secrets (private, not `NEXT_PUBLIC_`).

## 5. Hosting — Vercel + domain
- [ ] Connect the GitHub repo; set the production branch.
- [ ] Add all env vars (see §6). Mark server secrets as encrypted; `NEXT_PUBLIC_*` are build-time inlined.
- [ ] Point the apex/`www` domain at Vercel; verify TLS.
- [ ] Set `NEXT_PUBLIC_APP_URL=https://<domain>` (drives canonical URLs / sitemap / JSON-LD).
- [ ] Confirm the build command runs `prisma generate` (postinstall) and `next build` succeeds on Vercel.

## 6. Production env vars (Vercel) — quick audit
| Var | Prod value |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Neon prod (pooled / direct) |
| `NEXT_PUBLIC_FIREBASE_*` | prod Firebase client config |
| `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` | prod Admin SDK (secrets) |
| `NEXT_PUBLIC_FIREBASE_TEST_MODE` | **unset / absent** |
| `R2_ENDPOINT/ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET` | R2 prod |
| `R2_FORCE_PATH_STYLE` | **unset** (R2 = vhost) |
| `R2_PUBLIC_BASE_URL` | `https://img.pashusetu.in` (or `https://pub-<hash>.r2.dev`) — bare origin |
| `NEXT_PUBLIC_APP_URL` | `https://<domain>` |

## 7. Security & headers (doc 12)
- [ ] Confirm the built CSP has **no `'unsafe-eval'`** (dev-only, `NODE_ENV`-gated) and includes the R2 storage origin in `connect-src`/`img-src` (env-derived). `[code ✓]`
- [ ] HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, Referrer-Policy, Permissions-Policy present on prod responses (ST-09 header check).
- [ ] No test/seed credentials or `seed-farmer-*` users in the prod DB.
- [ ] Rate limits / abuse controls reviewed (auth resend cooldown + Firebase server limits + App Check).

## 8. SEO / PWA
- [ ] `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, `llms.txt` resolve on the prod domain and reference it.
- [ ] JSON-LD renders on listing detail; canonical URLs use `NEXT_PUBLIC_APP_URL`.
- [ ] PWA installable; offline shell works.

## 9. Monitoring & ops
- [x] **Error monitoring (PS-005) — wired `[code ✓]`.** A dependency-free, DSN-gated reporter (`lib/monitoring/sentry.ts`) captures server errors (`withRoute` catch + `instrumentation.ts` `onRequestError`) and client errors (`app/global-error.tsx` + `ErrorMonitor` window listeners). It is a **no-op until a DSN is set**, and scrubs phone numbers before sending (BR-066).
  - [ ] **You:** create the Sentry project → set `SENTRY_DSN` (server secret) + `NEXT_PUBLIC_SENTRY_DSN` (same value, client) in Vercel; confirm the first prod error appears in Sentry.
  - [ ] If the DSN host is region-based (`*.ingest.<region>.sentry.io`), confirm `connect-src` in `next.config.ts` allows it for the *client* reporter (server capture is unaffected). Current CSP allows `https://*.ingest.sentry.io`.
  - [ ] *Optional later:* upgrade to `@sentry/nextjs` for **source maps** (readable prod stack traces) + performance tracing. Deferred deliberately — its build plugin is a risk against the Next 16 + Turbopack build the CI/QA pipeline shares.
- [ ] Uptime monitor on `/api/v1/health` — does a real DB round-trip; returns `{status:'ok',db:'ok'}` (200) or `{status:'degraded',db:'unreachable'}` (503). `[code ✓]`
- [ ] Vercel Analytics / logs; Neon + R2 usage dashboards; Firebase SMS spend alert.
- [ ] Documented rollback (Vercel instant rollback to previous deploy; DB migration back-out plan).

## 10. Legal / compliance (doc 16 — for counsel review)
- [ ] Privacy Policy + Terms published and linked.
- [ ] Seller declaration wording (slaughter-sale prohibition) confirmed with counsel; it's already enforced in the wizard/submit.
- [ ] No Aadhaar stored; data-retention + grievance contact per IT Rules 2021.

## 11. Pre-launch verification (gate — all green before launch)
- [ ] CI green on `main` (lint, typecheck, unit, build, prisma drift, security-gates).
- [ ] Full E2E against **staging (real Firebase / Supabase / Neon)**: OTP login → wizard (incl. compulsory **taluka**) → photo upload → submit → admin approve → public browse → **contact reveals phone** (call/WhatsApp).
- [ ] **Real browser photo upload to Supabase works** (presigned `PUT` from the wizard — the one path not yet exercised; confirms Supabase Storage CORS). `[covers §3 CORS item]`
- [ ] **No dead links / 404s** in the shipped nav (favorites tab + notifications bell already removed). `[code ✓]`
- [ ] **Demo listings cleared** (or replaced with genuine listings) — see §0; the contact action must never reveal a fake seller phone to a real buyer.
- [ ] Sentry receives a test error (client + server); `/api/v1/health` returns `{db:ok}`.
- [ ] Lighthouse on 3G/mid Android meets NFR budgets (listing page usable < 5s on 3G).
- [ ] No horizontal overflow at 360/768/1024/1440; Marathi renders; 130% font-scale OK.
- [ ] Real low-end Android device smoke test (Redmi/Galaxy-class).

## 12. Launch day + rollback
- [ ] Deploy from `main`; verify health, a real OTP to a real phone, one real listing end-to-end.
- [ ] Watch Sentry + SMS spend for the first hours.
- [ ] Rollback: `vercel rollback` to the previous deploy; DB is forward-compatible (no destructive migration in the release).

## 13. Post-launch
- [ ] Remove/disable any remaining debug flags.
- [ ] Confirm moderation SLA workflow with the admin.
- [ ] Backfill real breed/district data corrections as they surface from the pilot districts.
