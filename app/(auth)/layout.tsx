// (auth) route group — docs/09-backend/README.md §1. /login and /profile ARE
// the auth surface; the client-side gate for protected pages (my-listings,
// favorites, sell, notifications) lands with those pages' stories and lives in
// their own guard, so this layout stays a pass-through shell.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // No width cap here — the (auth) group is mixed-width (My Listings is "wide"
  // 768; login/profile/wizard are "form" ≤480), so each page sets its own
  // Container variant. p-4 supplies the 16px mobile edge for all of them;
  // pb-24 leaves room for the root BottomNav on nav-tab pages.
  return <main className="min-h-screen p-4 pb-24">{children}</main>
}
