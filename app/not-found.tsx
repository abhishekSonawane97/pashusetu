// Branded Marathi 404 — replaces Next's default English "This page could not be
// found" page. Reached by any unmatched URL and by notFound() (e.g. a WhatsApp-
// shared link to a listing that was removed, rejected, or never existed — a common
// real path). A rural user on a dead link needs a clear way back, not a bare error.

import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { Container } from '@/components/layout/Container'

export default function NotFound() {
  return (
    <Container variant="form">
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 p-8 text-center">
        <Icon name="search" size={44} className="text-[var(--color-text-3)]" />
        <div>
          <h1 className="text-[24px] font-bold">हे पान सापडले नाही</h1>
          <p className="mt-2 text-[16px] leading-[1.6] text-[var(--color-text-2)]">
            तुम्ही शोधत असलेले जनावर किंवा पान आता उपलब्ध नाही. कदाचित ती जाहिरात काढली गेली असेल.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[var(--h-button)] w-full items-center justify-center rounded bg-[var(--color-primary)] px-5 font-bold text-[var(--color-on-primary)]"
          >
            मुख्य पानावर जा
          </Link>
          <Link
            href="/listings"
            className="inline-flex min-h-[var(--h-button)] w-full items-center justify-center rounded border border-[var(--color-primary)] bg-[var(--color-surface)] px-5 font-bold text-[var(--color-primary)]"
          >
            जनावरे पहा
          </Link>
        </div>
      </main>
    </Container>
  )
}
