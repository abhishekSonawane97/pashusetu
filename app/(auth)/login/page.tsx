'use client'

// S-02 (phone entry) + S-03 (OTP verify) — docs/05-features/auth.md, Flow D.
// Unstyled-functional per doc 15 §1.4: semantic HTML, real Marathi strings,
// correct states and behavior; the design-system skin is applied at gate R2.

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithCustomToken, signOut } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/layout/Container'
import { TextField } from '@/components/ui/Field'
import {
  MAX_WRONG_ATTEMPTS,
  isValidPhone,
  normalizePhoneInput,
  resendWaitSeconds,
  safeReturnTo,
} from '@/lib/auth/otp-helpers'

// 'finishing' = OTP verified + signed in to Firebase; only post-auth routing
// remains (retryable WITHOUT re-verifying the now-consumed, single-use code).
type Step = 'phone' | 'otp' | 'banned' | 'finishing'

function LoginFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo'))

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [lastSendAt, setLastSendAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // 1 s tick drives the S-03 timer + resend countdown.
  useEffect(() => {
    if (step !== 'otp') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [step])

  // WebOTP auto-read — progressive enhancement; manual entry always works.
  // Re-armed on every send (lastSendAt dep) so a RESENT code also auto-fills.
  useEffect(() => {
    if (step !== 'otp' || !('OTPCredential' in window)) return
    const ac = new AbortController()
    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const code = (cred as unknown as { code?: string })?.code
        if (code) setOtp(code.replace(/\D/g, '').slice(0, 6))
      })
      .catch(() => {}) // unsupported/aborted — manual entry remains
    return () => ac.abort()
  }, [step, lastSendAt])

  const secondsSinceSend = lastSendAt ? (now - lastSendAt) / 1000 : Infinity
  const codeInvalidated = wrongAttempts >= MAX_WRONG_ATTEMPTS
  const resendWait = resendWaitSeconds(secondsSinceSend, codeInvalidated)

  const sendOtp = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await apiFetch('/api/v1/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      })
      if (!res.ok) {
        // No attempt counters exposed — avoids abuse probing (auth.md Fields note).
        setError(
          res.status === 429
            ? 'खूप वेळा प्रयत्न झाला. थोड्या वेळाने पुन्हा पाठवा.'
            : 'OTP पाठवता आला नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.',
        )
        return
      }
      setLastSendAt(Date.now())
      setWrongAttempts(0)
      setOtp('')
      setStep('otp')
    } catch {
      setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.')
    } finally {
      setBusy(false)
    }
  }, [phone])

  const routeAfterAuth = useCallback(async () => {
    const res: Response = await apiFetch('/api/v1/users/me')
    if (res.status === 404) {
      router.replace(`/profile?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }
    if (res.ok) {
      const me = await res.json()
      if (me.status === 'BANNED') {
        await signOut(getFirebaseAuth())
        setStep('banned')
        return
      }
      router.replace(returnTo)
      return
    }
    const body = await res.json().catch(() => null)
    if (body?.error?.code === 'USER_BANNED') {
      await signOut(getFirebaseAuth())
      setStep('banned')
      return
    }
    setError('काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.')
  }, [returnTo, router])

  // Post-auth routing, isolated from verify so a transient failure here (offline,
  // /users/me hiccup) is retried WITHOUT re-submitting the now-consumed OTP.
  const finishSignIn = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      await routeAfterAuth()
    } catch {
      setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.')
    } finally {
      setBusy(false)
    }
  }, [routeAfterAuth])

  // Once signed in ('finishing'), drive routing; retryable via the button below.
  useEffect(() => {
    if (step === 'finishing') void finishSignIn()
  }, [step, finishSignIn])

  const verifyOtp = useCallback(async () => {
    if (codeInvalidated) return
    setError(null)
    setBusy(true)
    try {
      const res = await apiFetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code: otp }),
      })
      if (res.ok) {
        const { customToken } = (await res.json()) as { customToken: string }
        await signInWithCustomToken(getFirebaseAuth(), customToken)
        setStep('finishing') // signed in — routing runs in the finishing effect (retryable)
        return
      }
      const body = await res.json().catch(() => null)
      const otpError = body?.error?.details?.fields?.otp as string | undefined
      if (res.status === 429 || otpError === 'expired') {
        setWrongAttempts(MAX_WRONG_ATTEMPTS) // code dead / too many tries → force resend
        setError('OTP ची मुदत संपली किंवा खूप वेळा प्रयत्न झाला. नवीन OTP मागवा.')
        return
      }
      const attempts = wrongAttempts + 1
      setWrongAttempts(attempts)
      setError(
        attempts >= MAX_WRONG_ATTEMPTS
          ? '3 वेळा चुकीचा कोड. नवीन OTP मागवा.'
          : 'चुकीचा OTP. पुन्हा प्रयत्न करा.',
      )
    } catch {
      setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.') // network loss mid-flow
    } finally {
      setBusy(false)
    }
  }, [codeInvalidated, otp, phone, wrongAttempts])

  if (step === 'finishing') {
    // Signed in; finishing post-auth routing. On a transient failure, retry the
    // routing only — never the consumed OTP (avoids a needless new-SMS loop).
    return (
      <section aria-live="polite" className="flex flex-col gap-4 pt-8">
        <h1 className="text-[22px] font-bold">लॉगिन पूर्ण करत आहोत…</h1>
        {error && (
          <>
            <p role="alert" className="text-[16px] text-[var(--color-error)]">
              {error}
            </p>
            <Button loading={busy} onClick={() => void finishSignIn()}>
              पुन्हा प्रयत्न करा
            </Button>
          </>
        )}
      </section>
    )
  }

  if (step === 'banned') {
    // Full-screen banned block (BR-014): grievance contact, session signed out.
    return (
      <section aria-live="assertive" className="flex flex-col gap-4 pt-8">
        <h1 className="text-[22px] font-bold text-[var(--color-error)]">खाते बंद आहे</h1>
        <p className="text-[18px] leading-[1.6]">
          नियमांच्या उल्लंघनामुळे तुमचे खाते बंद आहे. संपर्क: support@pashusetu.in / हेल्पलाइन
        </p>
        <Link href="/" className="font-bold text-[var(--color-primary)]">
          मुख्य पानावर परत जा
        </Link>
      </section>
    )
  }

  if (step === 'phone') {
    return (
      <section className="flex flex-col gap-5 pt-6">
        <div>
          <h1 className="text-[22px] font-bold">विक्रेत्याशी बोलण्यासाठी आधी लॉगिन करा</h1>
          <p className="mt-2 text-[16px] text-[var(--color-text-2)]">
            तुमचा मोबाईल नंबर टाका. आम्ही SMS ने कोड पाठवू.
          </p>
        </div>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (isValidPhone(phone)) void sendOtp()
            else setError('बरोबर 10 अंकी मोबाईल नंबर टाका')
          }}
        >
          <TextField
            label="मोबाईल नंबर"
            hint="हा नंबर फक्त लॉगिनसाठी वापरला जाईल"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10 अंकी नंबर"
            value={phone}
            onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
            error={error}
          />
          <Button type="submit" loading={busy} disabled={!isValidPhone(phone)}>
            OTP पाठवा
          </Button>
        </form>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5 pt-6">
      <div>
        <h1 className="text-[22px] font-bold">SMS मधील 6 अंकी कोड टाका</h1>
        <p className="mt-2 text-[16px] text-[var(--color-text-2)]">
          +91 {phone} वर कोड पाठवला आहे.{' '}
          <button
            type="button"
            className="font-bold text-[var(--color-primary)] underline"
            onClick={() => setStep('phone')}
          >
            नंबर बदला
          </button>
        </p>
      </div>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          void verifyOtp()
        }}
      >
        <TextField
          label="OTP कोड"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          error={error}
        />
        <Button type="submit" loading={busy} disabled={otp.length !== 6 || codeInvalidated}>
          पुढे जा
        </Button>
      </form>
      <Button variant="ghost" disabled={resendWait > 0 || busy} onClick={() => void sendOtp()}>
        {resendWait > 0 ? `पुन्हा पाठवा — ${resendWait} से` : 'OTP पुन्हा पाठवा'}
      </Button>
    </section>
  )
}

export default function LoginPage() {
  return (
    <Container variant="form">
      <Suspense>
        <LoginFlow />
      </Suspense>
    </Container>
  )
}
