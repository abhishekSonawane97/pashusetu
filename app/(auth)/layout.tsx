// (auth) route group — docs/09-backend/README.md §1. /login and /profile ARE
// the auth surface; the client-side gate for protected pages (my-listings,
// favorites, sell, notifications) lands with those pages' stories and lives in
// their own guard, so this layout stays a pass-through shell.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // pb-24 leaves room for the root BottomNav on nav-tab auth pages (sell/
  // favorites/profile); login + wizard hide the nav but the extra pad is benign.
  return <main className="mx-auto min-h-screen w-full max-w-md p-4 pb-24">{children}</main>
}
