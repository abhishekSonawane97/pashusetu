// (public) route group — browse without login (BR-060). Bottom nav is present
// on these screens (hidden only in wizard/auth/admin, handled inside BottomNav).
// Bottom padding leaves room for the fixed nav + safe-area inset.

import { BottomNav } from '@/components/layout/BottomNav'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto min-h-screen w-full max-w-md pb-24">{children}</div>
      <BottomNav />
    </>
  )
}
