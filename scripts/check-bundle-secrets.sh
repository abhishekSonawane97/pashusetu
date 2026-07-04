#!/usr/bin/env bash
# Bundle secret grep (doc 13 §4.5, doc 12 SEC-T15): fail the build if any
# server-side secret pattern appears in client-delivered JS. Runs after
# `next build` over .next/static/**.
set -euo pipefail

STATIC_DIR=".next/static"
if [ ! -d "$STATIC_DIR" ]; then
  echo "ERROR: $STATIC_DIR not found — run 'pnpm build' first." >&2
  exit 1
fi

# Server-only secret signatures. NEXT_PUBLIC_* values are allowed by design.
PATTERNS=(
  'BEGIN [A-Z ]*PRIVATE KEY'      # Firebase Admin / any PEM key
  'postgres(ql)?://[^"]*@'        # DATABASE_URL / DIRECT_URL with credentials
  'FIREBASE_PRIVATE_KEY'
  'FIREBASE_CLIENT_EMAIL'
  'R2_SECRET_ACCESS_KEY'
  'R2_ACCESS_KEY_ID'
  'MSG91_AUTH_KEY'
  'CRON_SECRET'
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  if grep -rEl "$pattern" "$STATIC_DIR" >/dev/null 2>&1; then
    echo "SECRET PATTERN IN CLIENT BUNDLE: $pattern" >&2
    grep -rEl "$pattern" "$STATIC_DIR" >&2
    FOUND=1
  fi
done

if [ "$FOUND" -ne 0 ]; then
  echo "FAIL: server-side secret material found in client bundle (doc 12 SEC-T15)." >&2
  exit 1
fi
echo "OK: no secret patterns in client bundle."
