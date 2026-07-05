// AdminGate — client gate for /admin/** (F-10 / BR-012). The API is the real
// authority (requireAdmin re-reads is_admin per request); this gate only decides
// what to render: skeleton while the session + profile resolve, the login wall
// if logged out, a plain "no access" screen for non-admins, children for admins.

'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/firebase/use-auth'
import { apiFetch } from '@/lib/api/client'
import { Skeleton } from '@/components/ui/Skeleton'

type Check = 'checking' | 'admin' | 'denied'

export function AdminGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [check, setCheck] = useState<Check>('checking')

  useEffect(() => {
    if (auth.status === 'out') {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`)
    }
  }, [auth.status, pathname, router])

  // Verify is_admin against /users/me once the session is in. Cancellable IIFE
  // so the sets are all post-await (no synchronous setState in the effect body).
  useEffect(() => {
    if (auth.status !== 'in') return
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/api/v1/users/me')
        if (cancelled) return
        const me = res.ok ? await res.json() : null
        if (cancelled) return
        setCheck(me?.isAdmin ? 'admin' : 'denied')
      } catch {
        if (!cancelled) setCheck('denied')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auth.status])

  if (auth.status === 'in' && check === 'admin') return <>{children}</>

  if (auth.status === 'in' && check === 'denied') {
    return (
      <section className="flex flex-col gap-4 pt-10 text-center">
        <h1 className="text-[22px] font-bold text-[var(--color-error)]">प्रवेश नाही</h1>
        <p className="text-[16px] text-[var(--color-text-2)]">हे पान फक्त प्रशासकांसाठी आहे.</p>
        <Link href="/" className="font-bold text-[var(--color-primary)]">
          मुख्य पानावर परत जा
        </Link>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4" aria-busy>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
