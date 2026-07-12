// Swappable SMS-OTP sender. India-native providers (Fast2SMS default) deliver the
// code on THEIR own DLT-registered OTP template — so we do no DLT registration —
// from UPI-funded accounts (no credit card, ~₹0.15/OTP vs Firebase's ~₹6). Pick
// with SMS_OTP_PROVIDER; the surface is a single call, so adding MSG91/2Factor
// later is one more branch with no change to callers. The code and the API key
// are NEVER included in thrown messages or logs.

export async function sendOtpSms(phoneE164: string, code: string): Promise<void> {
  // `||` not `??`: an env var set to '' (e.g. a blank line copied from .env.example
  // or an empty Vercel var) must fall back to the default, not select provider ''.
  const provider = process.env.SMS_OTP_PROVIDER || 'fast2sms'
  switch (provider) {
    case 'fast2sms':
      return sendViaFast2Sms(phoneE164, code)
    default:
      throw new Error(`unknown SMS_OTP_PROVIDER: ${provider}`)
  }
}

// The delivered message on the open-template ('quick') route. Kept short + ASCII
// for reliable delivery on the international gateway. On the DLT 'otp' route the
// wording is fixed by the approved template instead (this is ignored there).
const otpMessage = (code: string): string =>
  `Your PashuSetu OTP is ${code}. Valid for 5 minutes. Do not share it with anyone.`

// Fast2SMS bulkV2. FAST2SMS_ROUTE selects the route with NO code change:
//   'quick' → route=q, international gateway, NO DLT (₹5/SMS, open template) — the
//             pre-DLT bridge; sends the full otpMessage(code).
//   'otp'   → route=otp, Fast2SMS OTP route, needs a DLT-approved template; cheaper
//             (~₹0.15–0.25) + branded sender. Use once DLT registration is done.
// API key in the Authorization header, 10-digit national number (no +91). Success
// is HTTP 200 with { return: true }.
async function sendViaFast2Sms(phoneE164: string, code: string): Promise<void> {
  const key = process.env.FAST2SMS_API_KEY
  if (!key) throw new Error('FAST2SMS_API_KEY is not set')

  const numbers = phoneE164.replace(/^\+91/, '')
  const route = process.env.FAST2SMS_ROUTE || 'otp'
  const params =
    route === 'quick'
      ? { route: 'q', message: otpMessage(code), language: 'english', flash: '0', numbers }
      : { route: 'otp', variables_values: code, numbers }

  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: key,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })

  let ok = false
  try {
    ok = ((await res.json()) as { return?: boolean })?.return === true
  } catch {
    ok = false // non-JSON body ⇒ treat as failure
  }
  if (!res.ok || !ok) {
    throw new Error(`fast2sms send failed (status ${res.status})`)
  }
}
