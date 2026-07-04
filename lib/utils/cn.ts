// Minimal class combiner — joins truthy class strings. No dependency; sufficient
// for our token-driven components (we don't do Tailwind class-merge conflicts).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
