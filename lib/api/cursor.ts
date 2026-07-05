// Opaque keyset cursor — doc 08 §1.4 / §4.2, doc 07 §4.1. Encodes the keyset
// tuple of the last item as base64url of {"k":[<key>,<id>]}. Clients MUST NOT
// parse or construct it; a malformed/undecodable cursor → the caller throws
// 400 VALIDATION_ERROR and the client silently restarts from page one.

export type CursorKey = string | number

export function encodeCursor(key: CursorKey, id: string): string {
  const json = JSON.stringify({ k: [key, id] })
  return Buffer.from(json, 'utf8').toString('base64url')
}

/** Returns [key, id] or null when the token is malformed (caller → 400). */
export function decodeCursor(cursor: string): [CursorKey, string] | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    const k = parsed?.k
    if (
      Array.isArray(k) &&
      k.length === 2 &&
      (typeof k[0] === 'string' || typeof k[0] === 'number') &&
      typeof k[1] === 'string'
    ) {
      return [k[0], k[1]]
    }
    return null
  } catch {
    return null
  }
}
