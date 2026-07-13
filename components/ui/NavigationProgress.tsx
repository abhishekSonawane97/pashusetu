// Top progress bar for client-side navigations. Next's App Router shows NO
// feedback while a route transition fetches (a 2-3s RSC load looks like a dead
// tap, so users re-tap). This starts a thin bar the instant an internal link/tab
// is clicked and finishes it when the new path commits — YouTube/GitHub style.
// Uses usePathname only (never useSearchParams) so it doesn't force every page
// out of static rendering.

'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

type Phase = 'idle' | 'loading' | 'done'

export function NavigationProgress() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<Phase>('idle')

  // Start on a plain left-click of an internal link to a DIFFERENT path.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return
      }
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const href = a.getAttribute('href') ?? ''
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return
      }
      let url: URL
      try {
        url = new URL(a.href, location.href)
      } catch {
        return
      }
      if (url.origin !== location.origin || url.pathname === location.pathname) return
      setPhase('loading')
    }
    document.addEventListener('click', onClick, true) // capture, so we see it before navigation
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // New path committed → finish the bar.
  useEffect(() => {
    setPhase((p) => (p === 'loading' ? 'done' : p))
  }, [pathname])

  // 'done' → idle after the fill/fade; a safety timeout clears a stalled/cancelled nav.
  useEffect(() => {
    if (phase === 'done') {
      const t = setTimeout(() => setPhase('idle'), 350)
      return () => clearTimeout(t)
    }
    if (phase === 'loading') {
      const t = setTimeout(() => setPhase('idle'), 12000)
      return () => clearTimeout(t)
    }
  }, [phase])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px]">
      <div
        className="h-full bg-[var(--color-primary)] shadow-[0_0_8px_var(--color-primary)]"
        style={{
          width: phase === 'loading' ? '92%' : phase === 'done' ? '100%' : '0%',
          opacity: phase === 'idle' ? 0 : 1,
          transition:
            phase === 'loading'
              ? 'width 2.2s cubic-bezier(0.15, 0.7, 0.3, 1)'
              : 'width 0.18s ease-out, opacity 0.3s ease 0.15s',
        }}
      />
    </div>
  )
}
