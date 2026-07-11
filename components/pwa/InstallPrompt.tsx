// Custom "Add to Home Screen" prompt (NFR-11 / doc 10 §7.4). Rules: appears only
// from the user's SECOND session (never first visit), only if not already
// installed and not previously dismissed, and only once the browser fires
// `beforeinstallprompt` (Chrome/Android; iOS Safari doesn't fire it and the
// audience is overwhelmingly Android per PRD A-01). Dismissible; the decision
// persists. Rendered on S-05 (home).
'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'ps_install_dismissed'
const SESSIONS_KEY = 'ps_sessions'
const SESSION_FLAG = 'ps_session_counted' // sessionStorage: one count per tab session

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Count this session once (sessionStorage resets when the tab session ends).
    let sessions = Number(localStorage.getItem(SESSIONS_KEY) ?? '0')
    if (!sessionStorage.getItem(SESSION_FLAG)) {
      sessions += 1
      localStorage.setItem(SESSIONS_KEY, String(sessions))
      sessionStorage.setItem(SESSION_FLAG, '1')
    }
    const dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    const installed = window.matchMedia('(display-mode: standalone)').matches
    if (sessions < 2 || dismissed || installed) return // not eligible → never bind

    // setState happens inside the event callback, not synchronously in the effect.
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault() // keep the browser's own mini-infobar from showing
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (!show || !deferred) return null

  const install = async () => {
    const d = deferred
    await d.prompt()
    // TODO(NFR-10 analytics): emit `pwa_installed` when outcome === 'accepted'.
    await d.userChoice.catch(() => {})
    setShow(false)
    setDeferred(null)
  }
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  return (
    <div
      role="dialog"
      aria-label="अ‍ॅप इंस्टॉल करा"
      className="fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-3xl px-4"
    >
      <div className="flex items-center gap-3 rounded-card border border-[var(--color-border-card)] bg-[var(--color-surface)] p-3 shadow-card">
        <p className="flex-1 text-[15px] font-bold leading-[1.5]">
          पशुसेतू फोनवर ठेवा — एक टॅप मध्ये उघडा
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[var(--touch-min)] shrink-0 px-2 text-[14px] font-bold text-[var(--color-text-2)]"
        >
          नको
        </button>
        <button
          type="button"
          onClick={install}
          className="min-h-[var(--touch-min)] shrink-0 rounded bg-[var(--color-primary)] px-4 font-bold text-[var(--color-on-primary)]"
        >
          इंस्टॉल करा
        </button>
      </div>
    </div>
  )
}
