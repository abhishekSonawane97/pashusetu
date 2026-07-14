'use client'

// Share control for the listing detail (S-07, WS2). People already forward animals
// into WhatsApp groups — this makes that one tap and brings viewers back to
// PashuSetu. Primary path is the native Web Share sheet (navigator.share), which on
// mobile offers WhatsApp / Facebook / Telegram / etc. directly. Desktop or browsers
// without Web Share fall back to explicit per-platform links + copy-link. The shared
// payload is the PUBLIC listing url + a Marathi blurb (never the seller phone — BR-066);
// the page's per-listing OG image makes the link preview show the animal.

import { useState } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Icon, type IconName } from '@/components/ui/Icon'

export function ShareButton({ url, text }: { url: string; text: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const full = `${text}\n${url}` // text carrying the url, for text-only share targets

  async function onShare() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'पशुसेतू', text, url })
      } catch {
        /* user dismissed the native sheet — do nothing */
      }
      return
    }
    setOpen(true) // no Web Share (desktop) → explicit platform links
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the link is still visible in the platform buttons */
    }
  }

  const rows: Array<{ href: string; icon: IconName; label: string }> = [
    {
      href: `https://wa.me/?text=${encodeURIComponent(full)}`,
      icon: 'whatsappPlaceholder',
      label: 'WhatsApp',
    },
    {
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      icon: 'share',
      label: 'Facebook',
    },
    {
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      icon: 'send',
      label: 'Telegram',
    },
  ]

  const rowCls =
    'flex items-center gap-3 border-b border-[var(--color-border-card)] py-3 text-[16px] font-bold text-[var(--color-text)]'

  return (
    <>
      <button
        type="button"
        aria-label="शेअर करा"
        onClick={onShare}
        className="fixed right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
      >
        <Icon name="share" size={20} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="शेअर करा">
        <div className="flex flex-col">
          {rows.map((r) => (
            <a
              key={r.label}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className={rowCls}
              onClick={() => setOpen(false)}
            >
              <Icon name={r.icon} size={22} className="text-[var(--color-text-2)]" />
              {r.label}
            </a>
          ))}
          <button
            type="button"
            onClick={copyLink}
            className={rowCls + ' text-left'}
            aria-live="polite"
          >
            <Icon name="duplicate" size={22} className="text-[var(--color-text-2)]" />
            {copied ? 'लिंक कॉपी झाली ✓' : 'लिंक कॉपी करा'}
          </button>
        </div>
      </BottomSheet>
    </>
  )
}
