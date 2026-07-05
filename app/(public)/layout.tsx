// (public) route group — browse without login (BR-060). BottomNav lives in the
// root layout (shown across public + auth tabs, self-hidden in wizard/login/
// admin); the pb-24 here leaves room for the fixed nav + safe-area inset.
// All public pages are the "wide" column (768 on desktop, §7.1); below md the
// cap stays 448 so phones/tablets are unchanged.

import { Container } from '@/components/layout/Container'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container variant="wide" className="min-h-screen pb-24">
      {children}
    </Container>
  )
}
