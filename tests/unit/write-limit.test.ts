// Rolling-window write limiter (doc 09 §10.1, BR-090 #2) — window math verified
// against a fake executor; the SQL itself is integration-tested on a Neon
// branch once PS-003/PS-015 land (doc 14 ST-06 covers the atomicity race).
import { describe, expect, it } from 'vitest'
import { AppError } from '@/lib/errors/app-error'
import { enforceWriteLimit, type RawQueryExecutor } from '@/lib/rate-limit/write-limit'

function fakeDb(row: { count: number | bigint | null; oldest: Date }): RawQueryExecutor {
  return {
    async $queryRaw<T>() {
      return [row] as T
    },
  }
}

describe('enforceWriteLimit', () => {
  const NOW = 1_750_000_000_000

  it('allows the 60th write in the window', async () => {
    await expect(
      enforceWriteLimit(fakeDb({ count: 60, oldest: new Date(NOW - 59_000) }), 'user1', () => NOW),
    ).resolves.toBeUndefined()
  })

  it('rejects the 61st write with RATE_LIMITED and correct retryAfterSeconds', async () => {
    // Oldest still-counting hit was 45 s ago → it leaves the window in 15 s.
    const attempt = enforceWriteLimit(
      fakeDb({ count: 61, oldest: new Date(NOW - 45_000) }),
      'user1',
      () => NOW,
    )
    await expect(attempt).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      httpStatus: 429,
      details: { retryAfterSeconds: 15 },
    })
    await expect(attempt).rejects.toBeInstanceOf(AppError)
  })

  it('never returns retryAfterSeconds below 1', async () => {
    await expect(
      enforceWriteLimit(fakeDb({ count: 61, oldest: new Date(NOW - 60_000) }), 'user1', () => NOW),
    ).rejects.toMatchObject({ details: { retryAfterSeconds: 1 } })
  })

  it('handles bigint counts from Postgres', async () => {
    await expect(
      enforceWriteLimit(
        fakeDb({ count: BigInt(61), oldest: new Date(NOW - 30_000) }),
        'user1',
        () => NOW,
      ),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})
