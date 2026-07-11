// Client window-level error capture (PS-005 / go-live §9). global-error.tsx
// covers React-render errors; this covers the rest — uncaught errors in event
// handlers and unhandled promise rejections. Reports to the dependency-free
// Sentry reporter (a no-op unless NEXT_PUBLIC_SENTRY_DSN is set). Renders nothing.

'use client'

import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring/sentry'

export function ErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void captureException(event.error ?? event.message, {
        source: 'window.onerror',
        filename: event.filename,
      })
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      void captureException(event.reason, { source: 'unhandledrejection' })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
