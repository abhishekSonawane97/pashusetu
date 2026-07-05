// BottomNav — design hard rule 6: EXACTLY 4 tabs (होम / विका / आवडते / प्रोफाइल),
// hidden inside the wizard, max 2 levels of depth. Every icon carries its visible
// Marathi label (hard rule 5). Safe-area inset for PWA standalone mode.

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

const TABS: Array<{ href: string; icon: IconName; label: string; match: (p: string) => boolean }> =
  [
    { href: '/', icon: 'home', label: 'होम', match: (p) => p === '/' },
    { href: '/sell', icon: 'sell', label: 'विका', match: (p) => p.startsWith('/sell') },
    {
      href: '/favorites',
      icon: 'favorite',
      label: 'आवडते',
      match: (p) => p.startsWith('/favorites'),
    },
    {
      href: '/profile',
      icon: 'profile',
      label: 'प्रोफाइल',
      match: (p) => p.startsWith('/profile'),
    },
  ]

// Routes where the bottom nav is hidden (wizard + auth surfaces).
const HIDDEN = [/^\/sell\/new/, /^\/login/, /^\/admin/]

export function BottomNav() {
  const pathname = usePathname()
  if (HIDDEN.some((re) => re.test(pathname))) return null

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border-card)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]"
      aria-label="मुख्य नेव्हिगेशन"
    >
      {/* Bar spans the viewport; tabs sit in a row capped to the content column so
          they align under the centered 768 content on desktop (identical on phones,
          where max-w-3xl never binds). */}
      <div className="mx-auto flex w-full max-w-3xl">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[var(--touch-min)] flex-1 flex-col items-center justify-center gap-1 py-2 text-[14px] font-bold',
                active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-2)]',
              )}
            >
              <Icon name={tab.icon} size={24} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
