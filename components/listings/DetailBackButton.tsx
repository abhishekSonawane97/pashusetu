'use client'

// Floating back control for the listing detail (S-07). The detail page hides the
// bottom nav and is the app's main WhatsApp-shared entry point, so without this a
// deep-linked (or SOLD) listing is a dead-end with no way back into the app. Goes
// back in-app when there is history, else home — so a fresh shared-link open never
// strands the user. Fixed top-left so it stays reachable while scrolling.

import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'

export function DetailBackButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      aria-label="मागे"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back()
        else router.push('/')
      }}
      className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
    >
      <Icon name="arrowLeft" size={22} />
    </button>
  )
}
