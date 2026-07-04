# Feature: Phone-OTP Authentication & Session (F-01)

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 1.0 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-04 |
| **Depends on** | [../01-prd/README.md](../01-prd/README.md) (F-01) · [../04-business-rules/README.md](../04-business-rules/README.md) (BR-010, BR-011, BR-013, BR-014, BR-090 #1) · [../06-user-flows/README.md](../06-user-flows/README.md) (Flow D, S-02, S-03, S-04) · [../12-security/README.md](../12-security/README.md) |

## Purpose

Let a first-time smartphone user log in with nothing but their mobile number and an SMS code. Firebase Authentication (phone provider, locked decision D3) does the entire OTP round-trip in the client SDK; the backend never sends an OTP (BR-090 #1) and only verifies Firebase ID tokens with the Admin SDK. The verified phone number is the trust anchor for the whole contact-seller funnel.

## User stories

- As a **farmer** with only a phone number, I want to log in with an SMS code so I never need a password or email.
- As a **returning buyer**, I want the app to remember me so I go straight to browsing without re-entering anything.
- As a **banned user**, I want to see why I am blocked and whom to contact, instead of a silent failure.

## Preconditions & permissions

| Aspect | Value |
|---|---|
| Who | Anyone with an Indian mobile number (one phone = one account, BR-010) |
| Login required | No — this feature *is* login. Browse never requires it (BR-060) |
| Role | None; every account is farmer- and buyer-capable (BR-011). `is_admin` grants admin routes only (BR-012) |
| Entry points | Login wall (contact/favorite/report tap while anonymous), Sell tab, Favorites tab, Profile tab while anonymous; direct route `/login?returnTo=<path>` |

## UX workflow

1. An anonymous user triggers a login-gated action → **S-02** opens (bottom sheet over the current screen, or full-screen from the Profile tab) with the context title "विक्रेत्याशी बोलण्यासाठी आधी लॉगिन करा" (To talk to the seller, log in first) when raised as a contact wall.
2. User enters a 10-digit mobile number. Client validates (digits only, starts 6–9) before any Firebase call, then taps "OTP पाठवा" (Send OTP) → Firebase client SDK sends the OTP.
3. **S-03** opens: 6-digit code input with auto-read via the WebOTP API (progressive enhancement; manual entry always works), a 60 s timer, an attempt counter, and a disabled "OTP पुन्हा पाठवा" (Send OTP again) button.
4. **Resend rule:** resend unlocks when the 60 s timer expires, or immediately after a 3rd wrong attempt invalidates the code — always subject to a minimum **30 s cooldown since the last send**. The button shows the remaining cooldown ("पुन्हा पाठवा — 18 से").
5. **Lockout rule:** wrong code attempts 1 and 2 show the inline error and keep the code valid; the **3rd wrong attempt invalidates the code**, disables the verify button, and shows "3 वेळा चुकीचा कोड. नवीन OTP मागवा." (Wrong code 3 times. Request a new OTP.) The user must resend.
6. On a correct code, Firebase issues an ID token. The client calls `GET /users/me` with `Authorization: Bearer <token>`:
   - **404 (no profile)** → route to **S-04** profile setup ([profile.md](profile.md)); after `POST /users` succeeds, continue to `returnTo`.
   - **200, status ACTIVE** → returning user: route to `returnTo`, else the origin screen, else **S-05** home. The remembered pending action (contact reveal, favorite, report, sell) executes automatically (doc 06 §3.2 login-wall contract).
   - **200/403, status BANNED** → full-screen block with grievance contact (see States); the client signs the Firebase session out.
7. **Session:** the Firebase SDK persists the session and silently refreshes the 1-hour ID token. On a hard 401 the client forces one token refresh and retries once; if that fails, the login sheet opens preserving `returnTo` (PRD FR-01).
8. **Logout** (row on S-15): signs out of the Firebase SDK, clears cached user data, favorites cache, and notification badge, then routes to S-05. Protected routes thereafter redirect to `/login`.

## Fields & validation

| Field | Type | Required | Validation rule | Error message EN | Error message MR |
|---|---|---|---|---|---|
| phone | string | Yes | Exactly 10 digits, first digit 6–9; normalized to E.164 `+91XXXXXXXXXX` before the Firebase call; non-digits stripped on paste | Enter a valid 10-digit mobile number | बरोबर 10 अंकी मोबाईल नंबर टाका |
| otp | string | Yes | Exactly 6 digits; verified by the Firebase client SDK only | Wrong OTP. Try again. | चुकीचा OTP. पुन्हा प्रयत्न करा. |

Send-failure copy (Firebase throttling or network): EN "Could not send OTP. Try again in a little while." / MR "OTP पाठवता आला नाही. थोड्या वेळाने पुन्हा प्रयत्न करा." (no attempt counters exposed — avoids abuse probing, doc 06 Flow D).

## Business logic

- OTP send/verify is 100% Firebase client SDK; the backend exposes **no OTP endpoint** and never sends auth SMS — BR-010, BR-090 #1.
- One phone number = one account; `users.phone` and `users.firebase_uid` are unique — BR-010. A duplicate `POST /users` returns `USER_ALREADY_EXISTS`; the client then calls `GET /users/me` (idempotent recovery).
- Every authenticated request carries the Bearer ID token, verified server-side with the Firebase Admin SDK (default clock tolerance for device skew); missing/invalid/expired → 401 `UNAUTHENTICATED` — PRD FR-01, [../12-security/README.md](../12-security/README.md).
- Every authed request re-checks `users.status`; `BANNED` → 403 `USER_BANNED` on every endpoint except `GET /users/me` (so the app can render the banned screen with the helpline) — BR-014.
- Role flags are informational, never permission gates; permissions derive only from auth state + `is_admin` — BR-011.
- Authenticated writes additionally require a complete profile (name + district) else 403 `PROFILE_INCOMPLETE` → redirect to S-04 — BR-013.
- Multiple simultaneous devices are allowed; no session invalidation in MVP (PRD F-01 edge case).

## API usage

| Method + path | When |
|---|---|
| `GET /api/v1/users/me` | Immediately after every successful Firebase verification, and on app cold start with a persisted session, to resolve profile/ban state |
| `POST /api/v1/users` | Once, from S-04, when `GET /users/me` returned 404 (first login) — see [profile.md](profile.md) |
| *(all other endpoints)* | Carry `Authorization: Bearer <Firebase ID token>`; this feature owns acquiring and refreshing that token |

## States

| State | What the user sees |
|---|---|
| Loading | S-02: "OTP पाठवा" button shows an inline spinner and disables while Firebase sends. S-03: verify button spinner during code check and during `GET /users/me`. |
| Empty | S-03 with no digits entered: verify disabled; timer and auto-read hint visible. |
| Error | Inline errors per the Fields table; send failure keeps the entered number; 3rd wrong attempt shows the lockout message and enables resend (after cooldown). Network loss mid-flow: "इंटरनेट नाही. पुन्हा प्रयत्न करा." with retry. |
| Success | Sheet closes; user lands on `returnTo`/origin with the pending action auto-executed; returning users see no auth UI at all (silent session restore). |
| Edge | **Banned:** full-screen block "नियमांच्या उल्लंघनामुळे तुमचे खाते बंद आहे. संपर्क: support@pashusetu.in / हेल्पलाइन" (Your account is suspended for rule violations. Contact: …), signed out, back-link to public S-05. **Killed between S-03 and S-04:** Firebase session persists; next open routes straight to S-04. **Recycled telco number:** new owner inherits the account — accepted MVP risk (PRD F-01). **Clock skew:** one forced token refresh + retry on 401. |

## Analytics

| Event | Fired when | Properties |
|---|---|---|
| `signup_complete` | Fired by [profile.md](profile.md) on successful `POST /users` (first login completes only when the profile exists) | `districtId`, `languagePref` |

No event fires for returning-user logins (server truth: `users` table). No OTP-step events — the funnel gap between login-wall open and `signup_complete` is an accepted MVP blind spot (keeps the frozen event list intact, README §3.4).

## Acceptance criteria

1. Entering a valid 10-digit number and tapping "OTP पाठवा" triggers a Firebase OTP SMS and shows S-03 within 2 s; invalid numbers never reach Firebase (client validation blocks the call).
2. A correct 6-digit code signs the user in; wrong attempts 1–2 show "चुकीचा OTP. पुन्हा प्रयत्न करा." inline without a page reload; the 3rd wrong attempt invalidates the code, disables verify, and shows the lockout message until a new code is sent.
3. The resend button is disabled for 30 s after every send, unlocks at the 60 s timer expiry (or post-lockout, cooldown permitting), and shows the remaining cooldown seconds.
4. First-time verification (no `users` row) routes to S-04 and, after profile save, lands on the original `returnTo` with the pending action executed automatically; returning users skip S-04 entirely.
5. Every authenticated API request carries the Bearer ID token; the server verifies it with the Firebase Admin SDK; a missing/expired token returns 401 `UNAUTHENTICATED` in the standard envelope, and the client force-refreshes once before surfacing the login wall.
6. A BANNED user can complete Firebase auth but every API call except `GET /users/me` returns 403 `USER_BANNED`; the UI shows the full-screen banned notice with support@pashusetu.in and signs the Firebase session out.
7. Logout signs out of the Firebase SDK, clears all locally cached user data, routes to S-05, and any subsequent protected navigation redirects to `/login?returnTo=<path>`.
8. Token refresh is silent during an active session — no user is interrupted by a re-login while the SDK can refresh.

## Out of scope

- Email, password, Aadhaar, or any KYC (foundation §8; BR-010).
- Backend-sent OTP or MSG91 OTP fallback (explicit non-goal, PRD A-05).
- WhatsApp OTP, Truecaller one-tap verification, device management, session revocation on ban (`revokeRefreshTokens`) — Phase 2 candidates (PRD F-01 future improvements).
- Number-change / re-verification flow for recycled numbers — Phase 2.

## Acceptance checklist

- [x] All mandatory sections of README §2 present in order, plus this checklist per foundation §7
- [x] OTP send/verify is Firebase client SDK only (locked decision D3); backend exposes no OTP endpoint and never sends auth SMS per BR-010 / BR-090 #1
- [x] One phone = one account (BR-010), role-less accounts (BR-011), profile-completeness gate (BR-013), and BANNED handling (BR-014, 403 `USER_BANNED` on all endpoints except `GET /users/me`) all cited from doc 04 without contradiction
- [x] Resend/lockout rules stated decision-completely (60 s timer, 30 s minimum cooldown, 3rd wrong attempt invalidates the code) and restated verbatim in the acceptance criteria
- [x] Only canonical `/api/v1` endpoints referenced (`GET /api/v1/users/me`, `POST /api/v1/users`); error codes match the doc 08 registry (`UNAUTHENTICATED`, `USER_BANNED`, `PROFILE_INCOMPLETE`, `USER_ALREADY_EXISTS`)
- [x] Screens cited as S-02/S-03/S-04 per doc 06 Flow D, including the login-wall `returnTo` pending-action contract (doc 06 §3.2)
- [x] Analytics limited to the frozen `signup_complete` event fired by profile.md; OTP-step funnel gap documented as an accepted MVP blind spot
- [x] All five states (loading/empty/error/success/edge) defined; Marathi strings are Devanagari with English gloss
- [x] ≥ 6 testable acceptance criteria; no TBD/TODO; no contradiction with D1–D10 or docs 04/06/08/12
