// Unit — the dependency-free Sentry reporter (PS-005). Verifies the three things
// that matter without a live DSN: it is a no-op when unconfigured (dev/CI never
// emit), it posts a well-formed envelope to the DSN's ingest URL when configured,
// and it scrubs phone numbers before sending (BR-066).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureException, isMonitoringEnabled, scrubPii } from '@/lib/monitoring/sentry'

const DSN = 'https://abc123def456@o99.ingest.us.sentry.io/1234567'
const OLD_ENV = { ...process.env }

type FetchInit = { method: string; headers: Record<string, string>; body: string }

function mockFetch() {
  const fn = vi.fn(async (_url: string, _init: FetchInit) => new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  process.env = { ...OLD_ENV }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('scrubPii (BR-066)', () => {
  it('redacts +91 / bare 10-digit Indian mobile numbers', () => {
    // Phones enter payloads as stored: E.164 (+919876543210) or bare 10-digit.
    expect(scrubPii('call +919876543210 now')).toBe('call [redacted-phone] now')
    expect(scrubPii('reveal 9876543210 here')).toBe('reveal [redacted-phone] here')
    expect(scrubPii('+91 9876543210')).toContain('[redacted-phone]')
  })
  it('leaves non-phone text untouched', () => {
    expect(scrubPii('order 12345 for ₹65,000')).toBe('order 12345 for ₹65,000')
  })
})

describe('captureException — no-op when unconfigured', () => {
  beforeEach(() => {
    delete process.env.SENTRY_DSN
    delete process.env.NEXT_PUBLIC_SENTRY_DSN
  })
  it('does not report when no DSN is set', () => {
    expect(isMonitoringEnabled()).toBe(false)
  })
  it('never calls fetch without a DSN', async () => {
    const fetchFn = mockFetch()
    await captureException(new Error('boom'))
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('captureException — configured', () => {
  beforeEach(() => {
    process.env.SENTRY_DSN = DSN
    process.env.SENTRY_ENVIRONMENT = 'production'
  })

  it('is enabled and posts one envelope to the DSN ingest URL', async () => {
    const fetchFn = mockFetch()
    await captureException(new Error('kaboom'))
    expect(isMonitoringEnabled()).toBe(true)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0]!
    expect(url).toBe('https://o99.ingest.us.sentry.io/api/1234567/envelope/')
    expect(init.method).toBe('POST')
    expect(init.headers['content-type']).toBe('application/x-sentry-envelope')
    expect(init.headers['x-sentry-auth']).toContain('sentry_key=abc123def456')
  })

  it('sends a 3-line envelope carrying the error message + environment', async () => {
    const fetchFn = mockFetch()
    await captureException(new Error('kaboom'))
    const body = fetchFn.mock.calls[0]![1].body
    const lines = body.split('\n')
    expect(lines).toHaveLength(3)
    const header = JSON.parse(lines[0])
    const event = JSON.parse(lines[2])
    expect(header.dsn).toBe(DSN)
    expect(event.exception.values[0].value).toBe('kaboom')
    expect(event.environment).toBe('production')
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('scrubs a seller phone out of the outgoing payload (BR-066)', async () => {
    const fetchFn = mockFetch()
    await captureException(new Error('reveal failed for +919876543210'))
    const body = fetchFn.mock.calls[0]![1].body
    expect(body).not.toContain('9876543210')
    expect(body).toContain('[redacted-phone]')
  })

  it('never throws even if the transport fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    await expect(captureException(new Error('boom'))).resolves.toBeUndefined()
  })
})
