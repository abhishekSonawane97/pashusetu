// Next.js instrumentation (PS-005 / go-live §9). `onRequestError` is the framework
// hook that fires for errors thrown while rendering Server Components, route
// handlers, and the like — the ones that never pass through withRoute()'s catch.
// We forward them to the dependency-free Sentry reporter (a no-op unless a DSN is
// set). `register` is required to exist but we have no startup work to do.

import { captureException } from '@/lib/monitoring/sentry'

export function register(): void {
  // No startup instrumentation needed (the reporter reads env lazily per call).
}

export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; renderSource?: string },
): Promise<void> {
  await captureException(error, {
    source: 'onRequestError',
    path: request?.path,
    method: request?.method,
    routerKind: context?.routerKind,
    routePath: context?.routePath,
    renderSource: context?.renderSource,
  })
}
