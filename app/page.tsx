// S-05 home — walking-skeleton landing, reskinned with the design system.
// The full browse surface (species chips + latest listings) lands with the
// Sprint 3 search slice; this proves tokens/fonts/components render and gives
// the deploy smoke test content to assert on.

import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 p-4">
      <header className="pt-8">
        <h1 className="text-[26px] font-bold text-[var(--color-primary)]">पशुसेतू</h1>
        <p className="mt-2 text-[18px] leading-[1.6] text-[var(--color-text)]">
          शेतकरी आणि खरेदीदारांना थेट जोडणारा विश्वासू पशुधन बाजार.
        </p>
        <p className="mt-1 text-[14px] text-[var(--color-text-2)]">हे ॲप पूर्णपणे मोफत आहे</p>
      </header>

      <Link
        href="/login"
        className="inline-flex min-h-[var(--h-button)] w-full items-center justify-center gap-2 rounded bg-[var(--color-primary)] px-5 font-bold text-[var(--color-on-primary)]"
      >
        <Icon name="profile" size={20} />
        लॉगिन करा
      </Link>

      <p className="text-[14px] text-[var(--color-text-3)]">
        Walking-skeleton build — browse &amp; listings arrive in the next slice.
      </p>
    </main>
  )
}
