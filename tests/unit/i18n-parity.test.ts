// PS-002 / PRD F-12 AC-3: the Marathi and English message catalogs must stay in
// lockstep — every key present in both files, no empty values. Marathi is the
// default locale (D8), so a key missing from mr.json is a shipped-English bug.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

type Catalog = { [key: string]: string | Catalog }

function flattenKeys(obj: Catalog, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      out.set(full, value)
    } else {
      for (const [k, v] of flattenKeys(value, full)) out.set(k, v)
    }
  }
  return out
}

function loadCatalog(locale: string): Map<string, string> {
  const file = path.join(__dirname, '..', '..', 'messages', `${locale}.json`)
  return flattenKeys(JSON.parse(readFileSync(file, 'utf8')))
}

describe('i18n catalog parity (mr <-> en)', () => {
  const mr = loadCatalog('mr')
  const en = loadCatalog('en')

  it('every en key exists in mr (Marathi-first: nothing may ship English-only)', () => {
    const missing = [...en.keys()].filter((k) => !mr.has(k))
    expect(missing).toEqual([])
  })

  it('every mr key exists in en (fallback locale must be complete)', () => {
    const missing = [...mr.keys()].filter((k) => !en.has(k))
    expect(missing).toEqual([])
  })

  it('no empty values in either catalog', () => {
    const empty = [
      ...[...mr.entries()].filter(([, v]) => v.trim() === '').map(([k]) => `mr:${k}`),
      ...[...en.entries()].filter(([, v]) => v.trim() === '').map(([k]) => `en:${k}`),
    ]
    expect(empty).toEqual([])
  })
})
