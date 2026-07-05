// (public) route group — browse without login (BR-060). BottomNav lives in the
// root layout (shown across public + auth tabs, self-hidden in wizard/login/
// admin); the pb-24 here leaves room for the fixed nav + safe-area inset.

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-screen w-full max-w-md pb-24">{children}</div>
}
