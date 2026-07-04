// withRoute() — the ONE route-level catch where errors become HTTP responses
// (docs/09-backend/README.md §5.2, envelope per docs/08-api/README.md §1.3).
// Route handlers parse + authenticate + validate + call a service + return;
// everything thrown lands here. Stack traces, Prisma messages and env values
// never reach the wire.

import { ZodError } from 'zod'
import { AppError } from './app-error'
import { mapPrismaError } from './prisma-map'
import { apiErrorMessage, resolveLocale } from '@/lib/i18n/api-messages'

type RouteContext = { params: Promise<Record<string, string>> }
type RouteHandler = (req: Request, ctx: RouteContext) => Promise<Response>

export function withRoute(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      return errorResponse(err, req)
    }
  }
}

export function errorResponse(err: unknown, req: Request): Response {
  const appError = toAppError(err)
  const locale = resolveLocale(req.headers.get('accept-language'))
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' })
  if (appError.code === 'RATE_LIMITED') {
    const retryAfter = Number(appError.details?.retryAfterSeconds ?? 60)
    headers.set('retry-after', String(retryAfter))
  }
  return new Response(
    JSON.stringify({
      error: {
        code: appError.code,
        message: apiErrorMessage(appError.messageKey, locale),
        ...(appError.details ? { details: appError.details } : {}),
      },
    }),
    { status: appError.httpStatus, headers },
  )
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err

  if (err instanceof ZodError) {
    return AppError.validation(zodFields(err), { malformed: isMalformed(err) })
  }

  const prismaMapped = mapPrismaError(err)
  if (prismaMapped) {
    if (prismaMapped.code === 'INTERNAL') captureUnexpected(err)
    return prismaMapped
  }

  // Unparseable JSON body surfaces as SyntaxError from req.json() (doc 09 §5.2).
  if (err instanceof SyntaxError) {
    return AppError.validation({ body: 'malformed JSON' }, { malformed: true })
  }

  captureUnexpected(err)
  return AppError.internal()
}

/** doc 08 §1.3: details.fields maps each offending field to a reason. */
export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.length ? issue.path.join('.') : 'body'
    if (!(path in fields)) fields[path] = issue.message
  }
  return fields
}

// 400 = malformed request (bad types/enums/unknown keys/bad cursor);
// 422 = well-formed but violates a domain field rule (doc 08 §1.3 split).
const MALFORMED_ISSUE_CODES = new Set(['invalid_type', 'invalid_value', 'unrecognized_keys'])

function isMalformed(error: ZodError): boolean {
  return error.issues.some((i) => MALFORMED_ISSUE_CODES.has(i.code))
}

// Sentry capture (doc 09 §5.4) is wired in PS-005; until then unexpected errors
// still reach the server log, never the wire.
function captureUnexpected(err: unknown): void {
  console.error('[unexpected-error]', err)
}
