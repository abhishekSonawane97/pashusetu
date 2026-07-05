// AuthGate — client login wall for authenticated pages (Flow D). While the
// Firebase session resolves, shows a skeleton; if logged out, redirects to the
// login sheet preserving returnTo (doc 06 §3.2). Children render only when in.

'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/firebase/use-auth'
import { Skeleton } from '@/components/ui/Skeleton'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (auth.status === 'out') {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`)
    }
  }, [auth.status, pathname, router])

  if (auth.status === 'in') return <>{children}</>
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
