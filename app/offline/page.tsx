// Branded offline page — NFR-11: a cold start with no network shows THIS, never
// the browser's default error page. Served by the service worker's navigation
// fallback when the network and cache both miss.

import { Icon } from '@/components/ui/Icon'

export const metadata = { title: 'इंटरनेट नाही — पशुसेतू' }

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <Icon name="warning" size={48} />
      <h1 className="text-[22px] font-bold text-[var(--color-primary)]">पशुसेतू</h1>
      <p className="text-[18px] leading-[1.6] text-[var(--color-text)]">
        इंटरनेट नाही. कृपया इंटरनेट जोडून पुन्हा प्रयत्न करा.
      </p>
      <p className="text-[14px] text-[var(--color-text-2)]">
        No internet. Please reconnect and retry.
      </p>
    </main>
  )
}
