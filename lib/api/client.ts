// Client-side API helper — docs/05-features/auth.md AC-5 / PRD FR-01: every
// authenticated request carries the Bearer ID token; on a hard 401 the client
// forces ONE token refresh and retries once before surfacing the login wall.
// Client code talks ONLY to /api/v1 (doc 09 §14).

import { getFirebaseAuth } from '@/lib/firebase/client'

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async (forceRefresh: boolean) => {
    const user = getFirebaseAuth().currentUser
    const headers = new Headers(init.headers)
    if (user) {
      headers.set('authorization', `Bearer ${await user.getIdToken(forceRefresh)}`)
    }
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
    return fetch(path, { ...init, headers })
  }

  const first = await doFetch(false)
  if (first.status !== 401 || !getFirebaseAuth().currentUser) return first
  return doFetch(true) // one silent refresh + retry (auth.md §7)
}
