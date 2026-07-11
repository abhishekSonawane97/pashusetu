# PashuSetu — Go-Live Checklist

> **Status:** Draft · **Owner:** Abhishek · **Depends on:** [13-deployment/README.md](./README.md) (runbooks), [12-security](../12-security/README.md), [16-legal](../16-legal/README.md)
>
> Work top-to-bottom. Everything here is **config/ops** unless marked `[code]`. Tick each box; nothing ships to real users until §11 is green.

---

## 0. Scope decision (do this first)

The create → approve → browse loop is live, but a buyer **cannot yet act on a listing**. Decide what the pilot ships with:

- [ ] **Contact-seller** (call/WhatsApp + interest event, E-07) — strongly recommended before a public pilot; without it the marketplace is read-only for buyers.
- [ ] Favorites (E-07), Report listing (E-09), Notifications/SMS (E-10) — decide in/out for pilot.
- [ ] Confirm which admin surfaces are needed (only moderation queue exists; Reports/Users/Stats do not).

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

## 3. Storage — Cloudflare R2 (swap from dev MinIO)
- [ ] Create two buckets: `pashusetu-uploads` (private) and `pashusetu-public` (public read).
- [ ] Attach a **custom domain** to the public bucket → `img.pashusetu.in` (or `img-dev` for staging).
- [ ] Set R2 **CORS** on the uploads bucket to allow the app origin: `PUT` + `Content-Type` header from `https://<app-domain>` (needed for the browser presigned upload).
- [ ] Env swap (no code change): `R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` (R2 API token), `R2_BUCKET=pashusetu`, **unset `R2_FORCE_PATH_STYLE`** (R2 uses vhost style), `R2_PUBLIC_BASE_URL=https://img.pashusetu.in/pashusetu-public` (match your public bucket path).
- [ ] The AWS-SDK flexible-checksum fix (`requestChecksumCalculation: WHEN_REQUIRED`, already committed) is **required** for R2 presigned uploads — confirm it's in `lib/r2/client.ts`. `[code ✓]`
- [ ] `next.config.ts` image `remotePatterns` already allows `img.pashusetu.in`; prod uses the optimizer (dev-only `unoptimized` is `NODE_ENV`-gated). `[code ✓]`

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
| `R2_PUBLIC_BASE_URL` | `https://img.pashusetu.in/...` |
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
- [ ] **Sentry (PS-005) — not yet built.** Add error monitoring before/at launch (client + server + source maps).
- [ ] Uptime monitor on `/api/v1/health` (returns `{db:ok}`).
- [ ] Vercel Analytics / logs; Neon + R2 usage dashboards; Firebase SMS spend alert.
- [ ] Documented rollback (Vercel instant rollback to previous deploy; DB migration back-out plan).

## 10. Legal / compliance (doc 16 — for counsel review)
- [ ] Privacy Policy + Terms published and linked.
- [ ] Seller declaration wording (slaughter-sale prohibition) confirmed with counsel; it's already enforced in the wizard/submit.
- [ ] No Aadhaar stored; data-retention + grievance contact per IT Rules 2021.

## 11. Pre-launch verification (gate — all green before launch)
- [ ] CI green on `main` (lint, typecheck, unit, build, prisma drift, security-gates).
- [ ] Full E2E against **staging (real Firebase/R2/Neon)**: OTP login → wizard (incl. compulsory **taluka**) → photo upload → submit → admin approve → public browse → contact (if shipped).
- [ ] Photo upload works against **R2** specifically (the checksum fix path).
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
