// Admin section layout (S-19/S-20). Dark chrome per design tokens (--color-dark),
// distinct from the consumer app so an admin always knows they are in the panel.
// The bottom nav self-hides on /admin (BottomNav HIDDEN /^\/admin/). The AdminGate
// is the client authorization wall; the API re-checks is_admin on every request.

import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminGate } from '@/components/admin/AdminGate'

// Admin panel is internal — never index (robots.txt also disallows /admin). NFR-09.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]">
      <header className="sticky top-0 z-10 bg-[var(--color-dark)] text-white shadow-header">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 lg:max-w-7xl">
          <Link href="/admin" className="text-[18px] font-bold">
            पशुसेतू — प्रशासन
          </Link>
          <Link href="/" className="text-[14px] underline opacity-90">
            अ‍ॅप उघडा
          </Link>
        </div>
        <nav className="mx-auto flex max-w-2xl gap-5 px-4 pb-2 text-[14px] font-bold lg:max-w-7xl">
          <Link href="/admin" className="opacity-90 hover:opacity-100">
            रांग
          </Link>
          <Link href="/admin/stats" className="opacity-90 hover:opacity-100">
            आकडेवारी
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-2xl p-4 lg:max-w-7xl">
        <AdminGate>{children}</AdminGate>
      </main>
    </div>
  )
}
