// Rolling-window write limiter — docs/09-backend/README.md §10.1 (BR-090 #2:
// 60 writes per user in any trailing 60 s; genuinely rolling, no doubled budget
// across a minute boundary). One atomic upsert per request — the row lock
// serializes parallel racers so the cap can never be exceeded (SEC-T11).
//
// The rate_limits table is deliberately NOT a Prisma model (infrastructure
// state); it is created by a hand-written migration (lands with PS-015) and
// accessed via tagged-template $queryRaw — parameterized, SEC-T14 compliant.
// The executor is injected so the window logic is unit-testable without a DB.

import { AppError } from '@/lib/errors/app-error'

export const WRITE_LIMIT = 60
export const WINDOW_SECONDS = 60

export type RawQueryExecutor = {
  $queryRaw<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>
}

type LimiterRow = { count: number | bigint | null; oldest: Date }

export async function enforceWriteLimit(
  db: RawQueryExecutor,
  userId: string,
  now: () => number = Date.now,
): Promise<void> {
  const rows = await db.$queryRaw<LimiterRow[]>`
    INSERT INTO rate_limits (key, hits, window_ends_at)
    VALUES (${'w:' + userId}, ARRAY[now()], now() + interval '60 seconds')
    ON CONFLICT (key) DO UPDATE SET
      hits = (SELECT coalesce(array_agg(t ORDER BY t), '{}')
              FROM unnest(rate_limits.hits) AS t
              WHERE t > now() - interval '60 seconds') || now(),
      window_ends_at = now() + interval '60 seconds'
    RETURNING array_length(hits, 1) AS count, hits[1] AS oldest`

  const row = rows[0]
  const count = Number(row?.count ?? 1)
  if (count > WRITE_LIMIT) {
    // Retry-After = seconds until the oldest still-counting hit leaves the window.
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((row.oldest.getTime() + WINDOW_SECONDS * 1000 - now()) / 1000),
    )
    throw AppError.rateLimited(retryAfterSeconds)
  }
}
