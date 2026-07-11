// S-07 contact bar (F-06 / API-21) — the login-walled reveal. Three actions call
// POST /listings/{id}/interest; the server logs the event and returns the seller
// phone + wa.me link (the phone never comes from SSR — BR-066). Anonymous taps
// raise the login wall (/login?returnTo=…&contact=TYPE) and auto-resume the
// remembered action after auth (Flow C). Owner viewing own listing → 403
// OWN_LISTING → we swap in an edit shortcut.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/firebase/use-auth'
import { apiFetch } from '@/lib/api/client'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import type { InterestType } from '@/lib/validation/common'

type Revealed = { name: string; phone: string; whatsappUrl: string }

const ACTIONS: Array<{ type: InterestType; label: string; icon: IconName }> = [
  { type: 'CALL', label: 'कॉल करा', icon: 'call' },
  { type: 'WHATSAPP', label: 'WhatsApp', icon: 'whatsappPlaceholder' },
  { type: 'INTEREST', label: 'आवड कळवा', icon: 'send' },
]

const RESUMABLE = new Set<string>(['CALL', 'WHATSAPP', 'INTEREST'])

export function ContactBar({
  listingId,
  sellerFirstName,
}: {
  listingId: string
  sellerFirstName: string
}) {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [busy, setBusy] = useState<InterestType | null>(null)
  const [revealed, setRevealed] = useState<Revealed | null>(null)
  const [activeType, setActiveType] = useState<InterestType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ownListing, setOwnListing] = useState(false)
  const resumedRef = useRef(false)

  const run = useCallback(
    async (type: InterestType) => {
      if (auth.status === 'loading') return
      if (auth.status === 'out') {
        // Remember the action so we can auto-resume after OTP login (Flow C).
        const back = `${pathname}?contact=${type}`
        router.push(`/login?returnTo=${encodeURIComponent(back)}`)
        return
      }
      setBusy(type)
      setError(null)
      try {
        const res = await apiFetch(`/api/v1/listings/${listingId}/interest`, {
          method: 'POST',
          body: JSON.stringify({ type }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          const code = body?.error?.code
          if (code === 'FORBIDDEN' && body?.error?.details?.reason === 'OWN_LISTING') {
            setOwnListing(true)
            return
          }
          if (code === 'RATE_LIMITED') {
            setError('आज खूप विक्रेत्यांशी संपर्क झाला आहे. कृपया उद्या पुन्हा प्रयत्न करा.')
            return
          }
          if (code === 'LISTING_NOT_FOUND') {
            setError('हे जनावर आता उपलब्ध नाही.')
            return
          }
          setError('काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.')
          return
        }
        const seller = body.seller as Revealed
        setActiveType(type)
        setRevealed(seller)
        // NFR-10 analytics hook (deferred): fire contact_call_tap / contact_whatsapp_tap /
        // send_interest here — only on this 2xx, so client events mirror the server truth.
        if (type === 'WHATSAPP') {
          window.open(seller.whatsappUrl, '_blank', 'noopener,noreferrer')
        }
      } catch {
        setError('नेटवर्क अडचण. कृपया पुन्हा प्रयत्न करा.')
      } finally {
        setBusy(null)
      }
    },
    [auth.status, listingId, pathname, router],
  )

  // Auto-resume the remembered action once, after a login redirect lands back here.
  useEffect(() => {
    if (auth.status !== 'in' || resumedRef.current) return
    const requested = new URLSearchParams(window.location.search).get('contact')
    if (requested && RESUMABLE.has(requested)) {
      resumedRef.current = true
      router.replace(pathname) // drop ?contact so a refresh/back doesn't re-fire
      void run(requested as InterestType)
    }
  }, [auth.status, pathname, router, run])

  if (ownListing) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border-card)] bg-[var(--color-surface)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <span className="text-[14px] text-[var(--color-text-2)]">ही तुमची जाहिरात आहे</span>
          <Link href="/sell" className="shrink-0">
            <Button variant="secondary" fullWidth={false}>
              <Icon name="edit" size={18} />
              जाहिरात बदला
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-[76px] z-40 mx-auto w-full max-w-3xl px-4"
        >
          <div className="rounded bg-[var(--color-error)] p-3 text-center text-[14px] font-bold text-white">
            {error}
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border-card)] bg-[var(--color-surface)] px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-3xl gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.type}
              type="button"
              onClick={() => run(a.type)}
              disabled={busy !== null}
              aria-busy={busy === a.type || undefined}
              className="flex min-h-[var(--touch-min)] flex-1 flex-col items-center justify-center gap-1 rounded py-1 text-[13px] font-bold text-[var(--color-primary)] disabled:opacity-50"
            >
              {busy === a.type ? (
                <span
                  className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                <Icon name={a.icon} size={24} />
              )}
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <BottomSheet
        open={revealed !== null}
        onClose={() => setRevealed(null)}
        title={`${sellerFirstName} यांच्याशी संपर्क`}
      >
        {revealed && (
          <div className="flex flex-col gap-4">
            {activeType === 'INTEREST' && (
              <p className="rounded bg-[var(--color-success-bg,#e8f5e9)] p-3 text-center text-[15px] font-bold text-[var(--color-text)]">
                विक्रेत्याला कळवले आहे 👍
              </p>
            )}
            <div className="text-center">
              <p className="text-[13px] text-[var(--color-text-2)]">फोन नंबर</p>
              <a
                href={`tel:${revealed.phone}`}
                className="text-[26px] font-bold text-[var(--color-primary)]"
                dir="ltr"
              >
                {revealed.phone}
              </a>
            </div>
            <a href={`tel:${revealed.phone}`} className="block">
              <Button variant="primary">
                <Icon name="call" size={20} />
                कॉल करा
              </Button>
            </a>
            <a
              href={revealed.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="secondary">
                <Icon name="whatsappPlaceholder" size={20} />
                WhatsApp वर बोला
              </Button>
            </a>
          </div>
        )}
      </BottomSheet>
    </>
  )
}
