'use client'

// AppMenu — the hamburger overflow/account menu (top-right of the home header).
// The bottom-nav carries the primary tabs; this holds everything else + the
// account: all sections, the logged-in user's identity, and LOG OUT (previously
// missing anywhere in the app — a real problem on shared rural phones). Opens the
// shared BottomSheet (backdrop / Esc / focus-trap already handled there), styled
// as a sheet on phones and a centered modal on desktop.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { useAuth } from '@/lib/firebase/use-auth'
import { useMe } from '@/lib/api/use-me'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Icon, type IconName } from '@/components/ui/Icon'

type MenuItem = { href: string; icon: IconName; label: string }
const ITEMS: MenuItem[] = [
  { href: '/', icon: 'home', label: 'होम' },
  { href: '/listings', icon: 'search', label: 'जनावरे पहा' },
  { href: '/sell', icon: 'sell', label: 'विका' },
  { href: '/profile', icon: 'profile', label: 'माझी प्रोफाइल' },
]

// +918329914036 → +91 83299 14036 (readable for the account owner).
function fmtPhone(e164?: string | null): string | null {
  if (!e164) return null
  const d = e164.replace(/^\+91/, '')
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : e164
}

const rowCls =
  'flex items-center gap-3 border-b border-[var(--color-border-card)] py-3 text-[16px] font-bold text-[var(--color-text)]'

export function AppMenu() {
  const router = useRouter()
  const auth = useAuth()
  const { profile } = useMe()
  const [open, setOpen] = useState(false)

  const loggedIn = auth.status === 'in'

  async function logout() {
    await signOut(getFirebaseAuth())
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        aria-label="मेनू"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text)]"
      >
        <span aria-hidden className="flex flex-col gap-[4px]">
          <span className="block h-[2px] w-[22px] rounded-full bg-current" />
          <span className="block h-[2px] w-[22px] rounded-full bg-current" />
          <span className="block h-[2px] w-[22px] rounded-full bg-current" />
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="मेनू">
        <div className="flex flex-col gap-4">
          {/* Account block — who you are signed in as (BR-014: shared-phone clarity). */}
          {loggedIn ? (
            <div className="flex items-center gap-3 rounded-card border border-[var(--color-border-card)] bg-[var(--color-surface-2)] p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)]">
                <Icon name="profile" size={24} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold">{profile?.name ?? 'तुमचे खाते'}</p>
                <p className="truncate text-[14px] text-[var(--color-text-2)]">
                  {fmtPhone(profile?.phone) ??
                    (profile ? (profile.district?.nameMr ?? '') : 'प्रोफाइल पूर्ण करा')}
                </p>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex min-h-[var(--h-button)] items-center justify-center gap-2 rounded bg-[var(--color-primary)] px-5 font-bold text-[var(--color-on-primary)]"
            >
              <Icon name="lock" size={20} />
              लॉगिन करा
            </Link>
          )}

          {/* All sections. */}
          <nav className="flex flex-col">
            {ITEMS.map((it) => (
              <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className={rowCls}>
                <Icon name={it.icon} size={22} className="text-[var(--color-text-2)]" />
                {it.label}
              </Link>
            ))}
            {profile?.isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className={rowCls}>
                <Icon name="stats" size={22} className="text-[var(--color-text-2)]" />
                जाहिरात तपासणी
              </Link>
            )}
          </nav>

          {/* Log out — only when signed in. */}
          {loggedIn && (
            <button
              type="button"
              onClick={logout}
              className="flex min-h-[var(--h-button)] items-center justify-center gap-2 rounded border border-[var(--color-error)] px-5 font-bold text-[var(--color-error)]"
            >
              <Icon name="logout" size={20} />
              बाहेर पडा
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  )
}
