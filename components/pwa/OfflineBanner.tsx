// Global offline banner — NFR-11: non-dismissible, shows while the browser
// reports offline ("इंटरनेट नाही — जुनी माहिती दाखवत आहोत"). Cached reads keep
// working; the app disables writes offline elsewhere.

'use client'

import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null
  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-[var(--color-warning-bg)] px-4 py-2 text-center text-[14px] font-bold text-[var(--color-warning)]"
    >
      इंटरनेट नाही — जुनी माहिती दाखवत आहोत
    </div>
  )
}
