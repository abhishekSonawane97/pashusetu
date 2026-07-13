// Floating "out" control for the listing detail (S-07). The detail page hides the
// bottom nav and is the app's main WhatsApp-shared entry point, so without this a
// deep-linked (or SOLD) listing is a dead-end with no way back into the app.
//
// It goes HOME rather than router.back(): a freshly-opened shared link has no safe
// in-app history (back() lands on a blank/external page and strands the user), and
// there is no reliable client-side way to tell an in-app arrival from a deep link
// (history.length counts the blank entry; referrer isn't set on client navigations).
// Home is always valid and never strands. Fixed top-left, reachable while scrolling.

import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

export function DetailBackButton() {
  return (
    <Link
      href="/"
      aria-label="मुख्य पानावर जा"
      className="fixed left-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
    >
      <Icon name="arrowLeft" size={22} />
    </Link>
  )
}
