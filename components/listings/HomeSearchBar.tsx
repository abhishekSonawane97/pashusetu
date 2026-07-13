'use client'

// Home search entry (S-05). Tapping it opens the filter panel IN PLACE (a bottom
// sheet on the home screen) instead of navigating to /listings — so the screen
// doesn't jump to a different-looking page on a single tap. The user picks filters
// right here; the sheet's "जाहिराती पहा" then shows the matching listings.

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { FilterSheet } from './FilterSheet'

export function HomeSearchBar() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[var(--h-input)] w-full items-center gap-2 rounded border border-[var(--color-border-input)] bg-[var(--color-surface-2)] px-4 text-left text-[16px] text-[var(--color-text-3)]"
      >
        <Icon name="search" size={20} />
        जनावर शोधा
      </button>
      <FilterSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
