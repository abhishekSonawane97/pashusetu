# Feature: Notifications — SMS + In-App (F-11)

| Field | Value |
|---|---|
| **Status** | Draft |
| **Version** | 1.0 |
| **Owner** | Founder (Abhishek) |
| **Last updated** | 2026-07-04 |
| **Depends on** | [../01-prd/README.md](../01-prd/README.md) (F-11) · [../04-business-rules/README.md](../04-business-rules/README.md) (BR-071, BR-072, BR-073, BR-090 #13/#18) · [../06-user-flows/README.md](../06-user-flows/README.md) (cross-flow, S-05, S-14) · [../09-backend/README.md](../09-backend/README.md) (§8 dispatcher) · [listing-create.md](listing-create.md) · [contact-seller.md](contact-seller.md) · [admin-moderation.md](admin-moderation.md) |

## Purpose

Close the loop on the seller's payoff moments — approved, rejected (with reason), buyer interest, expiry — for users who may not reopen the app for days. Every trigger writes an `INAPP` row (bell + S-14); the high-value subset also goes out as Marathi SMS via MSG91. In-app is required for beta; SMS may land in the final MVP sprint and the product must run correctly INAPP-only (PRD F-11 priority note). No web push in MVP.

## User stories

- As a **farmer who submitted a listing yesterday**, I want an SMS the moment it is approved so I know buyers can see my animal without checking the app.
- As a **seller whose listing was rejected**, I want the exact reason so I can fix it and resubmit instead of guessing.
- As a **seller nearing expiry**, I want a reminder 3 days before my listing closes so I can renew with one tap.
- As the **admin**, I want queue badges for new pending and auto-hidden listings so nothing waits past the 24 h SLA.

## Preconditions & permissions

| Aspect | Value |
|---|---|
| Who | Any logged-in `ACTIVE` user sees their own notifications; recipients are determined server-side per trigger (seller / admin / user) |
| Login required | **Yes** for S-14 and the bell badge (the bell renders logged-in only on S-05); profile completeness is NOT required (read-only surface) |
| Role | None; `NTF-ADMIN-*` rows go to all `is_admin = true` users except the seeded System user ([../09-backend/README.md](../09-backend/README.md) §8.3) |
| Banned users | Cannot fetch S-14 (`USER_BANNED` on every endpoint except `GET /users/me`, BR-014) — which is why the ban/unban pair is SMS-only |

## UX workflow

1. **Bell (S-05):** logged-in users see the bell with an unread badge = `meta.unreadCount` from `GET /users/me/notifications`, display capped at **"9+"** client-side (PRD F-11 AC-5). The shell refreshes the count on app start and on foreground/tab focus, at most once per 60 s — no polling loop, no push channel in MVP.
2. Tap bell (or the S-15 "सूचना" row, or an SMS deep link) → **S-14** "सूचना": newest-first list from `GET /api/v1/users/me/notifications` (INAPP rows only, cursor-paginated 20/50). Each item renders icon-per-type + title/body from the F-12 catalogs using `type` + `payload` (never server-composed copy), relative time in Latin digits, and an unread dot while `status = SENT`.
3. Tap an item → `POST /api/v1/notifications/{id}/read` (optimistic: dot cleared and badge decremented immediately; idempotent on repeat) → deep-link to the subject: `LISTING_APPROVED` / `INTEREST_RECEIVED` → **S-07** of the listing; `LISTING_REJECTED` / `EXPIRY_WARNING` / `LISTING_EXPIRED` / `LISTING_HIDDEN` → **S-11** (the tab holding the action: resubmit, renew, wait).
4. **SMS deep links** carry `{listingUrl}` → `/listings/{id}` (S-07); if the listing has since left `APPROVED`, S-07 shows the truthful unavailable/sold state ([listing-detail.md](listing-detail.md)) — never a crash.
5. **Server emission:** notification rows are written **inside the same transaction** as the triggering action (BR-071). `INAPP` rows are born `status = SENT`; `SMS` rows are born `PENDING` and dispatched post-commit (best-effort `waitUntil`) to the MSG91 Flow API, then updated to `SENT` or `FAILED` ([../09-backend/README.md](../09-backend/README.md) §8.2–8.3).
6. **Quiet hours:** SMS created outside **08:00–21:00 IST** stay `PENDING` and are flushed at the next window start (PRD F-11 AC-4); INAPP rows always appear immediately.

### Trigger table (canonical — BR-071 verbatim; `type` per [../08-api/README.md](../08-api/README.md) §1.9)

| Event | Recipient | Channel | Template id | API `type` | Tap target | Timing / notes |
|---|---|---|---|---|---|---|
| Listing approved (T-03) | Seller | SMS + INAPP | `NTF-LISTING-APPROVED` | `LISTING_APPROVED` | S-07 | Immediately on approval |
| Listing rejected (T-04) | Seller | SMS + INAPP | `NTF-LISTING-REJECTED` | `LISTING_REJECTED` | S-11 | `payload.reasonCode` + `payload.reasonMr` — the BR-043 Marathi label travels verbatim |
| Interest received (`type=INTEREST`) | Seller | INAPP always; SMS for the **first 3 interest SMS per seller per day**, further ones INAPP-only (BR-090 #13, silent downgrade) | `NTF-INTEREST-RECEIVED` | `INTEREST_RECEIVED` | S-07 | Immediately; `payload.buyerName`. CALL/WHATSAPP taps trigger **no** notification (BR-062) |
| Expiry warning | Seller | SMS + INAPP | `NTF-EXPIRY-WARNING` | `EXPIRY_WARNING` | S-11 | **3 days before `expires_at`**, once per approval cycle — deduped by an existing row for this listing + current `expires_at` (BR-071, BR-073); emitted by the daily 02:30 IST job (BR-072) |
| Listing expired (T-07) | Seller | INAPP | `NTF-LISTING-EXPIRED` | `LISTING_EXPIRED` | S-11 | Daily expiry job; SMS budget already spent on the warning |
| Listing auto-hidden (T-10, or a BR-052 resolve that hides) | Seller | INAPP | `NTF-LISTING-HIDDEN` | `LISTING_HIDDEN` | S-11 | "Your listing is under review" — no report details disclosed |
| Listing auto-hidden (T-10) | Admin | INAPP | `NTF-ADMIN-AUTOHIDE` | `ADMIN_AUTOHIDE` | S-21 | Red badge in the admin panel |
| New pending listing (T-02/T-05/T-09) | Admin | INAPP | `NTF-ADMIN-PENDING` | `ADMIN_PENDING` | S-19 | Feeds the queue badge count |
| User banned (BR-014) | User | SMS | `NTF-USER-BANNED` | `USER_BANNED` | — (banned block screen) | Includes the helpline for appeal (BR-055) |
| User unbanned (BR-055) | User | SMS | `NTF-USER-UNBANNED` | `USER_UNBANNED` | — | — |
| Report outcome (BR-052) | Reporter | **None — deliberate** | — | — | — | Reporters get the ticket-id acknowledgment at submit only ([reporting.md](reporting.md)); no outcome notification in MVP |

### SMS templates (Marathi canonical per BR-071 — meaning locked in doc 04; EN drafts are catalog glosses reserved for a future EN DLT set — MVP SMS is **Marathi only**, PRD F-11 AC-7)

| Template id | Marathi (Devanagari, sent verbatim) | English draft (≤ 160 GSM chars) |
|---|---|---|
| `NTF-LISTING-APPROVED` | PashuSetu: तुमची जाहिरात मंजूर झाली! ती आता खरेदीदारांना दिसत आहे. {listingUrl} | PashuSetu: Your listing is approved! It is now visible to buyers. {listingUrl} |
| `NTF-LISTING-REJECTED` | PashuSetu: तुमची जाहिरात मंजूर झाली नाही. कारण: {reasonMr}. कृपया दुरुस्त करून पुन्हा पाठवा. | PashuSetu: Your listing was not approved. Reason: {reason}. Please fix and resubmit. |
| `NTF-INTEREST-RECEIVED` | PashuSetu: एका खरेदीदाराने तुमच्या जनावरात रस दाखवला आहे. अ‍ॅपमध्ये पाहा. {listingUrl} | PashuSetu: A buyer has shown interest in your animal. See the app. {listingUrl} |
| `NTF-EXPIRY-WARNING` | PashuSetu: तुमची जाहिरात ३ दिवसांत बंद होईल. जनावर विकायचे असल्यास अ‍ॅपमध्ये 'पुन्हा सुरू करा' दाबा. {listingUrl} | PashuSetu: Your listing closes in 3 days. If the animal is still for sale, tap Renew in the app. {listingUrl} |
| `NTF-USER-BANNED` | PashuSetu: नियमांच्या उल्लंघनामुळे तुमचे खाते बंद करण्यात आले आहे. माहितीसाठी हेल्पलाइनवर संपर्क करा: {helpline} | PashuSetu: Your account has been suspended for rule violations. Contact the helpline: {helpline} |
| `NTF-USER-UNBANNED` | PashuSetu: तुमचे खाते पुन्हा सुरू करण्यात आले आहे. | PashuSetu: Your account has been reinstated. |

Devanagari SMS bill in 70-character Unicode segments; every template above fits **≤ 2 segments** (well inside the PRD ≤ 350-char budget). English drafts fit one 160-char GSM segment. Variables are `{#var#}` DLT slots for `listingUrl` / `reasonMr` / `helpline` only — never free text ([../09-backend/README.md](../09-backend/README.md) §8.2).

## Fields & validation

| Field | Type | Required | Validation rule | Error message EN | Error message MR |
|---|---|---|---|---|---|
| id (route param, API-24) | string (cuid) | Yes | Must be a notification owned by the caller; unknown or another user's id → 404 `NOT_FOUND` (masked, no existence leak) | Something went wrong. Please try again. | काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा. |
| cursor / limit (API-23) | string / int | No | §1.4 of [../08-api/README.md](../08-api/README.md) — limit 1–50 (out of range → 422 `VALIDATION_ERROR`); malformed cursor/non-integer → 400, client silently restarts from page one | Something went wrong. Please try again. | काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा. |

The feature has no user-composed input; all content is system-generated.

## Business logic

- **Transactional emission:** every notification row is written in the same DB transaction as its triggering action, so an approval without its notification (or vice versa) cannot exist — BR-071 enforcement.
- **Channel selection:** SMS is reserved for the events in the trigger table's SMS rows (payoff moments that must reach users who may not reopen the app); everything else is INAPP-only; admin events are always INAPP-only — BR-071.
- **Interest SMS cap:** max **3 interest SMS per seller per rolling day**, counted inside the creating transaction; the 4th+ interest that day silently downgrades to INAPP-only (no error) — BR-090 #13, BR-071.
- **Delivery lifecycle:** `notifications.status` = `PENDING → SENT | FAILED` for SMS; INAPP rows are born `SENT` and become `READ` via API-24 — BR-071; `unreadCount` = INAPP rows with `status = SENT` (API-23).
- **Failure handling:** SMS dispatch is async best-effort post-commit; the daily 03:00 IST housekeeping cron retries `FAILED` and stuck-`PENDING` SMS rows younger than 24 h once, then abandons them — the INAPP copy always remains as the fallback record ([../09-backend/README.md](../09-backend/README.md) §8.3; satisfies BR-071 "async with retry").
- **MSG91 + DLT dependency (hard external):** every SMS template must be pre-registered on TRAI DLT under the PashuSetu entity with sender ID `PSHSTU` and mapped in MSG91 before one SMS can deliver — a 2–6 week Sprint-1 task ([../13-deployment/README.md](../13-deployment/README.md) §2.6). Until approval, the sender marks rows `FAILED` (reason `DLT_PENDING`) and the product runs INAPP-only behind `FEATURE_SMS=0`; the PRD §10 launch gate explicitly permits launching that way.
- **Language:** SMS is always Marathi in MVP (single DLT template set — PRD F-11 AC-7); in-app items render from `type` + `payload` at read time, so they follow the recipient's **current** `language_pref` even if it changed after the row was created.
- **Privacy:** payloads carry only ids, listing titles, reason labels, and first names — never a phone number (BR-066); `NTF-LISTING-HIDDEN` discloses no report details and no reporter identity (BR-071, BR-050).
- **Retention:** notification rows are purged after **90 days** by the housekeeping cron — BR-071, BR-090 #18.

## API usage

| Method + path | When |
|---|---|
| `GET /api/v1/users/me/notifications` | S-14 open + pagination; first page also fetched by the shell for the bell badge (`meta.unreadCount`) on app start/foreground |
| `POST /api/v1/notifications/{id}/read` | On tapping an unread item in S-14 (idempotent; before the deep-link navigation) |

Emission happens server-side inside the owning features' endpoints (API-10/21/22/26/27/31/32 and the BR-072 cron) — this feature adds no emission endpoint.

## States

| State | What the user sees |
|---|---|
| Loading | S-14: skeleton list rows (never a blank screen); read-marking is optimistic, so no spinner on tap. |
| Empty | Illustration + "अजून सूचना नाहीत" (No notifications yet) + one CTA "जाहिराती पहा" (Browse listings) → S-05 (dead-end audit, doc 06 §7). |
| Error | List fetch failure → inline retry row "पुन्हा प्रयत्न करा" keeping any loaded items; failed read-mark → badge/dot revert silently (no toast — non-critical); offline → cached items with the standard stale banner (README §3.3). |
| Success | Item opens its deep-link target; dot cleared; badge decremented; no toast. |
| Edge | **Deep link to a since-archived/sold listing:** S-07 unavailable/sold state, no crash. **Language switched after creation:** item re-renders in the new language (payload-driven). **Read races (two tabs):** API-24 is idempotent; both get 200. **Another user's notification id:** 404 masked. **91-day-old row:** purged — SMS links to it still resolve via the listing URL, not the notification. **DLT not yet approved:** SMS rows `FAILED (DLT_PENDING)`, users see in-app only. |

## Analytics

No frozen NFR-10 event belongs to this feature, and none may be invented (README §3.4). Measurement is server-side product truth: the `notifications` table (volume, `SENT`/`FAILED` ratio per template id, read rate = `READ`/`SENT`) surfaced via `GET /api/v1/admin/stats`. SMS-driven return visits are measured indirectly by `listing_view` firing on the S-07 landing (owned by [listing-detail.md](listing-detail.md)).

## Acceptance criteria

1. Every trigger in the BR-071 table writes its notification row(s) with exactly the template ids and channels listed, **inside the same transaction** as the triggering action — verified by forcing a rollback after the action and observing zero notification rows.
2. The S-05 bell renders only for logged-in users, shows `meta.unreadCount` capped at "9+", and decrements when an item is opened.
3. Tapping an unread item calls `POST /notifications/{id}/read` (repeat call returns the same 200), and deep-links per the trigger table (approved/interest → S-07; rejected/expiry/expired/hidden → S-11); a forced read of another user's notification id returns a masked 404.
4. The 4th `INTEREST` event against the same seller within a rolling day produces an INAPP row but **no** SMS row (silent downgrade, BR-090 #13); the first 3 produce both.
5. `NTF-EXPIRY-WARNING` is emitted exactly once per approval cycle at T-3 days (re-running the BR-072 job creates no duplicate); expiry day itself produces `NTF-LISTING-EXPIRED` as INAPP only.
6. SMS rows move `PENDING → SENT` on MSG91 acceptance and `→ FAILED` otherwise; with `FEATURE_SMS=0` or DLT unapproved, rows are marked `FAILED` (`DLT_PENDING`), the in-app copy still exists, and no user-visible error occurs.
7. SMS created outside 08:00–21:00 IST remain `PENDING` and are flushed at the next window start; the corresponding INAPP row is visible immediately.
8. In-app items render in the recipient's current `language_pref` from the F-12 catalogs (including after a language switch); SMS bodies are the fixed Marathi BR-071 strings; rows older than 90 days are purged.

## Out of scope

- **Web push** — Phase 2, gated on PWA install base ≥ 20% of MAU (PRD §12); SMS + in-app only in MVP.
- WhatsApp Business API notifications, digest batching, per-type notification preferences, mark-all-read — Phase 2 (PRD F-11 future improvements).
- Reporter outcome notifications — deliberately none in MVP (BR-052; [reporting.md](reporting.md)).
- Buyer-side notifications (e.g., "a favorited listing was sold") — Phase 2; no MVP trigger exists.
- OTP SMS — never this feature: Firebase owns OTP entirely (BR-090 #1, [auth.md](auth.md)).

## Acceptance checklist

- [x] Trigger table reproduces all 10 BR-071 rows verbatim (template ids, recipients, channels, timings) plus explicit no-notification rows for report outcome (BR-052) and CALL/WHATSAPP taps (BR-062)
- [x] Marathi SMS copy is the BR-071 canonical text verbatim; EN drafts ≤ 160 GSM chars; segment budget stated
- [x] S-14 / S-05 bell behavior specified with read semantics (`POST /notifications/{id}/read`, idempotent, masked 404) and the "9+" badge rule (PRD F-11 AC-5)
- [x] Channel selection, quiet hours, 3/day/seller interest-SMS cap, and 90-day purge all cited to BR-071/BR-072/BR-073/BR-090
- [x] MSG91 DLT dependency (sender `PSHSTU`, `DLT_PENDING`, `FEATURE_SMS` fallback) and PENDING|SENT|FAILED|READ lifecycle with retry stance documented from docs 09/13
- [x] All five states defined; analytics restricted to server-side truth (no invented client events); ≥ 6 testable acceptance criteria; API paths match doc 08 exactly (API-23/24)
