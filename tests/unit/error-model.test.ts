// PS-004 acceptance: error envelope exact per doc 08 §1.3; RATE_LIMITED carries
// details.retryAfterSeconds and a Retry-After header; every specific code maps
// to its registered base family and status.
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AppError } from '@/lib/errors/app-error'
import { BASE_ERROR_CODES, SPECIFIC_ERROR_CODES, baseOf, httpStatusFor } from '@/lib/errors/codes'
import { errorResponse, withRoute } from '@/lib/errors/handle'
import { mapPrismaError } from '@/lib/errors/prisma-map'
import { parseJsonBody } from '@/lib/api/parse'

const req = (headers: Record<string, string> = {}) =>
  new Request('http://test.local/api/v1/x', { headers })

describe('error code registry (doc 08 §1.3)', () => {
  it('registers exactly the 10 base codes clients must handle', () => {
    expect(Object.keys(BASE_ERROR_CODES).sort()).toEqual(
      [
        'BANNED',
        'CONFLICT',
        'FORBIDDEN',
        'INTERNAL',
        'LIMIT_EXCEEDED',
        'NOT_FOUND',
        'RATE_LIMITED',
        'STATE_INVALID',
        'UNAUTHENTICATED',
        'VALIDATION_ERROR',
      ].sort(),
    )
  })

  it('every specific code resolves to a registered base and its own status', () => {
    for (const [code, spec] of Object.entries(SPECIFIC_ERROR_CODES)) {
      expect(BASE_ERROR_CODES).toHaveProperty(spec.base)
      expect(httpStatusFor(code as keyof typeof SPECIFIC_ERROR_CODES)).toBe(spec.httpStatus)
      expect(baseOf(code as keyof typeof SPECIFIC_ERROR_CODES)).toBe(spec.base)
    }
  })
})

describe('errorResponse envelope', () => {
  it('AppError → { error: { code, message, details } } with its httpStatus', async () => {
    const res = errorResponse(AppError.listingLimitReached(10), req())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toEqual({
      error: {
        code: 'LISTING_LIMIT_REACHED',
        message: expect.any(String),
        details: { activeCount: 10, limit: 10 },
      },
    })
  })

  it('RATE_LIMITED carries retryAfterSeconds and a Retry-After header (BR-090)', async () => {
    const res = errorResponse(AppError.rateLimited(17), req())
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('17')
    const body = await res.json()
    expect(body.error.details.retryAfterSeconds).toBe(17)
  })

  it('message is Marathi by default and English for Accept-Language: en (doc 08 §1.5)', async () => {
    const mr = await errorResponse(AppError.listingNotFound(), req()).json()
    const en = await errorResponse(
      AppError.listingNotFound(),
      req({ 'accept-language': 'en-IN,en;q=0.9' }),
    ).json()
    expect(mr.error.message).toBe('जाहिरात सापडली नाही.')
    expect(en.error.message).toBe('Listing not found.')
  })

  it('unknown errors → 500 INTERNAL with no internals leaked', async () => {
    const res = errorResponse(new Error('secret stack detail'), req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL')
    expect(JSON.stringify(body)).not.toContain('secret stack detail')
  })
})

describe('withRoute', () => {
  const ctx = { params: Promise.resolve({}) }

  it('passes through successful responses', async () => {
    const handler = withRoute(async () => Response.json({ ok: true }))
    const res = await handler(req(), ctx)
    expect(res.status).toBe(200)
  })

  it('maps ZodError from a strict schema: unknown keys → 400 with details.fields', async () => {
    const schema = z.object({ name: z.string() }).strict()
    const handler = withRoute(async (r) => {
      await parseJsonBody(r, schema)
      return Response.json({ ok: true })
    })
    const res = await handler(
      new Request('http://test.local/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'x', isAdmin: true }),
      }),
      ctx,
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details.fields).toBeDefined()
  })

  it('domain rule violation → 422 with the offending field', async () => {
    const schema = z.object({ price: z.number().int().min(500) })
    const handler = withRoute(async (r) => {
      await parseJsonBody(r, schema)
      return Response.json({ ok: true })
    })
    const res = await handler(
      new Request('http://test.local/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ price: 100 }),
      }),
      ctx,
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.details.fields.price).toBeDefined()
  })

  it('non-JSON content type on a body route → 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const handler = withRoute(async (r) => {
      await parseJsonBody(r, z.object({}))
      return Response.json({ ok: true })
    })
    const res = await handler(
      new Request('http://test.local/x', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'hi',
      }),
      ctx,
    )
    expect(res.status).toBe(415)
    expect((await res.json()).error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
  })

  it('malformed JSON → 400 VALIDATION_ERROR', async () => {
    const handler = withRoute(async (r) => {
      await parseJsonBody(r, z.object({}))
      return Response.json({ ok: true })
    })
    const res = await handler(
      new Request('http://test.local/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
      ctx,
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
  })
})

describe('prisma error mapping (doc 09 §5.3)', () => {
  it('P2002 on users.phone → USER_ALREADY_EXISTS', () => {
    const mapped = mapPrismaError({ code: 'P2002', meta: { target: ['users_phone_key'] } })
    expect(mapped?.code).toBe('USER_ALREADY_EXISTS')
  })
  it('P2002 on the one-open-report constraint → REPORT_ALREADY_EXISTS', () => {
    const mapped = mapPrismaError({
      code: 'P2002',
      meta: { target: 'reports_one_open_per_reporter' },
    })
    expect(mapped?.code).toBe('REPORT_ALREADY_EXISTS')
  })
  it('P2025 → NOT_FOUND; P2003 → 422 VALIDATION_ERROR; P2024 → INTERNAL', () => {
    expect(mapPrismaError({ code: 'P2025' })?.code).toBe('NOT_FOUND')
    const fk = mapPrismaError({ code: 'P2003' })
    expect(fk?.code).toBe('VALIDATION_ERROR')
    expect(fk?.httpStatus).toBe(422)
    expect(mapPrismaError({ code: 'P2024' })?.code).toBe('INTERNAL')
  })
  it('non-Prisma errors are not claimed', () => {
    expect(mapPrismaError(new Error('nope'))).toBeNull()
    expect(mapPrismaError({ code: 'EACCES' })).toBeNull()
  })
})
