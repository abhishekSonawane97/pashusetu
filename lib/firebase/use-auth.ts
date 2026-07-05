// Client auth state hook — tracks the Firebase session (docs/05-features/auth.md).
// Returns 'loading' until the SDK resolves persistence, then the user or null.

'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { getFirebaseAuth } from './client'

export type AuthState = { status: 'loading' } | { status: 'in' | 'out'; user: User | null }

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (user) => {
      setState(user ? { status: 'in', user } : { status: 'out', user: null })
    })
  }, [])
  return state
}
