// useMe — the logged-in user's DB profile (district/taluka/…), fetched once per
// session from GET /users/me. Returns null when logged out or when the profile
// row doesn't exist yet (first login, pre-S-04). Drives location-aware UI such as
// the "nearby animals" home feed; useAuth only exposes the Firebase session.

'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { useAuth } from '@/lib/firebase/use-auth'

export type MeProfile = {
  id: string
  name: string
  districtId: string | null
  district: { id: string; nameEn: string; nameMr: string; state: string } | null
  taluka: string | null
  village: string | null
  status: string
}

export function useMe(): { profile: MeProfile | null; loading: boolean } {
  const auth = useAuth()
  const [profile, setProfile] = useState<MeProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (auth.status === 'loading') return
    if (auth.status === 'out') {
      setProfile(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    apiFetch('/api/v1/users/me')
      .then((r) => (r.ok ? (r.json() as Promise<MeProfile>) : null))
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [auth.status])

  return { profile, loading }
}
