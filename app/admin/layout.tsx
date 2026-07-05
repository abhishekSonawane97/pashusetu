// Admin section layout (S-19/S-20). Dark chrome per design tokens (--color-dark),
// distinct from the consumer app so an admin always knows they are in the panel.
// The bottom nav self-hides on /admin (BottomNav HIDDEN /^\/admin/). The AdminGate
// is the client authorization wall; the API re-checks is_admin on every request.

import Link from 'next/link'
import { AdminGate } from '@/components/admin/AdminGate'

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
      </header>
      <main className="mx-auto w-full max-w-2xl p-4 lg:max-w-7xl">
        <AdminGate>{children}</AdminGate>
      </main>
    </div>
  )
}
