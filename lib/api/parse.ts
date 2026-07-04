// Request parsing helpers — docs/09-backend/README.md §4.1: route handlers parse
// body, query and path params BEFORE anything else; nothing downstream touches
// req.json() output raw. Content-type and JSON errors map per doc 09 §5.2.

import { type ZodType, type z } from 'zod'
import { AppError } from '@/lib/errors/app-error'

export async function parseJsonBody<S extends ZodType>(
  req: Request,
  schema: S,
): Promise<z.output<S>> {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw AppError.unsupportedMediaType()
  }
  // SyntaxError from req.json() is mapped to 400 VALIDATION_ERROR in withRoute().
  const raw = await req.json()
  return schema.parse(raw) // ZodError → withRoute() → 400/422 with details.fields
}

export function parseQuery<S extends ZodType>(req: Request, schema: S): z.output<S> {
  const url = new URL(req.url)
  const entries: Record<string, string> = {}
  for (const [key, value] of url.searchParams.entries()) entries[key] = value
  return schema.parse(entries)
}
