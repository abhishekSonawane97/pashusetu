// Minimal, dependency-free Sentry reporter (PS-005 / doc 09 §5.4, go-live §9).
//
// Why not @sentry/nextjs: its build-time webpack/turbopack plugin is a real risk
// against a brand-new Next 16 + Turbopack build that the CI/QA pipeline shares,
// and event delivery can't be verified without a live DSN either way. This module
// posts a Sentry *envelope* over plain fetch — no dependency, no build plugin, no
// package.json change. It is a NO-OP unless a DSN is set, so dev/local/CI never
// emit. Isomorphic: the same code runs on the server (SENTRY_DSN) and the client
// (NEXT_PUBLIC_SENTRY_DSN, a public value by Sentry's design).
//
// Trade-off vs the full SDK: no source maps (prod stack traces are minified) and
// no performance tracing. Both are a clean later upgrade — see docs/13 §9.
//
// BR-066: a seller phone must never leave our system to a third party, so every
// outgoing payload is scrubbed of phone-number patterns before it is sent.

type CaptureExtra = Record<string, unknown>

type SentryConfig = {
  ingestUrl: string
  publicKey: string
  dsn: string
  environment: string
  release?: string
}

// Read env at call time (not module load) so it works in both runtimes and is
// testable. Client bundles only inline NEXT_PUBLIC_*; SENTRY_DSN is undefined
// there, so the secret is never shipped to the browser.
function resolveConfig(): SentryConfig | null {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ''
  if (!dsn) return null
  let parsed: URL
  try {
    parsed = new URL(dsn)
  } catch {
    return null
  }
  const publicKey = parsed.username
  const projectId = parsed.pathname.replace(/^\/+/, '')
  if (!publicKey || !projectId) return null
  const environment =
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    'development'
  const release =
    process.env.SENTRY_RELEASE ||
    process.env.NEXT_PUBLIC_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    undefined
  return {
    ingestUrl: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`,
    publicKey,
    dsn,
    environment,
    release,
  }
}

/** True when a DSN is configured — used to skip work entirely in dev/CI. */
export function isMonitoringEnabled(): boolean {
  return resolveConfig() !== null
}

// BR-066 — never let a phone number reach Sentry. Matches +91/91-prefixed and
// bare 10-digit Indian mobile numbers anywhere in the serialized payload.
const PHONE_RE = /(\+?91[\s-]?)?[6-9]\d{9}/g
export function scrubPii(text: string): string {
  return text.replace(PHONE_RE, '[redacted-phone]')
}

function eventId(): string {
  // 32 hex chars, no dashes (Sentry event_id format).
  return globalThis.crypto.randomUUID().replace(/-/g, '')
}

function nowSeconds(): number {
  return Date.now() / 1000
}

function buildEvent(
  cfg: SentryConfig,
  level: 'error' | 'warning' | 'info',
  fields: { message?: string; error?: Error; extra?: CaptureExtra },
): Record<string, unknown> {
  const { error } = fields
  const event: Record<string, unknown> = {
    event_id: eventId(),
    timestamp: nowSeconds(),
    platform: typeof window === 'undefined' ? 'node' : 'javascript',
    level,
    environment: cfg.environment,
    ...(cfg.release ? { release: cfg.release } : {}),
  }
  if (error) {
    event.exception = { values: [{ type: error.name || 'Error', value: error.message }] }
  }
  if (fields.message) event.message = fields.message
  const extra: CaptureExtra = { ...(fields.extra ?? {}) }
  // Raw stack in `extra` (no structured frames without the SDK); still greppable.
  if (error?.stack) extra.stack = error.stack
  if (Object.keys(extra).length) event.extra = extra
  return event
}

async function send(cfg: SentryConfig, event: Record<string, unknown>): Promise<void> {
  const envelopeHeader = JSON.stringify({
    event_id: event.event_id,
    sent_at: new Date().toISOString(),
    dsn: cfg.dsn,
  })
  const itemHeader = JSON.stringify({ type: 'event' })
  // Scrub the whole serialized body (message + exception value + stack + extra).
  const body = scrubPii(`${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`)
  try {
    await globalThis.fetch(cfg.ingestUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${cfg.publicKey}, sentry_client=pashusetu-min/1.0`,
      },
      body,
      keepalive: true, // let the send survive a client unload / short-lived server invocation
    })
  } catch {
    // Best effort — monitoring must never throw into the app's error path.
  }
}

/** Report an unexpected error. No-op unless a DSN is configured. */
export async function captureException(error: unknown, extra?: CaptureExtra): Promise<void> {
  const cfg = resolveConfig()
  if (!cfg) return
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Non-Error value thrown')
  await send(cfg, buildEvent(cfg, 'error', { error: err, extra }))
}

/** Report a message (e.g. a degraded-but-handled condition). No-op unless configured. */
export async function captureMessage(
  message: string,
  level: 'error' | 'warning' | 'info' = 'info',
  extra?: CaptureExtra,
): Promise<void> {
  const cfg = resolveConfig()
  if (!cfg) return
  await send(cfg, buildEvent(cfg, level, { message, extra }))
}
