// Root error boundary (App Router). Catches errors thrown while rendering the
// React tree that no nested boundary handled. Reports to the dependency-free
// Sentry reporter (no-op unless a DSN is set) and shows a friendly Marathi
// fallback with a retry. global-error replaces the root layout, so it must render
// its own <html>/<body>.

'use client'

import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring/sentry'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    void captureException(error, { source: 'global-error', digest: error.digest })
  }, [error])

  return (
    <html lang="mr">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>काहीतरी चुकले</h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          क्षमस्व, तांत्रिक अडचण आली आहे. कृपया पुन्हा प्रयत्न करा.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            minHeight: '52px',
            padding: '0 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: '#C2185B',
            color: '#fff',
            fontWeight: 700,
            fontSize: '16px',
          }}
        >
          पुन्हा प्रयत्न करा
        </button>
      </body>
    </html>
  )
}
