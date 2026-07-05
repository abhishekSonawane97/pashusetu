// Opaque keyset cursor round-trip + malformed handling (doc 08 §1.4 / §4.2).
import { describe, expect, it } from 'vitest'
import { decodeCursor, encodeCursor } from '@/lib/api/cursor'

describe('cursor', () => {
  it('round-trips a string key (newest sort: createdAt ISO)', () => {
    const c = encodeCursor('2026-07-02T05:10:00.000Z', 'clx4l01bb0001l404gt6yh1n2')
    expect(decodeCursor(c)).toEqual(['2026-07-02T05:10:00.000Z', 'clx4l01bb0001l404gt6yh1n2'])
  })

  it('round-trips a numeric key (price sorts)', () => {
    const c = encodeCursor(65000, 'clx4l01bb0003')
    expect(decodeCursor(c)).toEqual([65000, 'clx4l01bb0003'])
  })

  it('is base64url (opaque, url-safe, no padding chars that break query strings)', () => {
    const c = encodeCursor('2026-07-02T05:10:00.000Z', 'abc')
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('returns null for malformed/garbage cursors (caller → 400, restart page one)', () => {
    expect(decodeCursor('not-base64!!')).toBeNull()
    expect(decodeCursor(Buffer.from('{"x":1}').toString('base64url'))).toBeNull()
    expect(decodeCursor(Buffer.from('[]').toString('base64url'))).toBeNull()
    expect(decodeCursor('')).toBeNull()
  })
})
