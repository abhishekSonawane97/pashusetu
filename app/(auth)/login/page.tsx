'use client'

// S-02 (phone entry) + S-03 (OTP verify) — docs/05-features/auth.md, Flow D.
// Unstyled-functional per doc 15 §1.4: semantic HTML, real Marathi strings,
// correct states and behavior; the design-system skin is applied at gate R2.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { apiFetch } from '@/lib/api/client'
import {
  MAX_WRONG_ATTEMPTS,
  isValidPhone,
  normalizePhoneInput,
  resendWaitSeconds,
  toE164,
} from '@/lib/auth/otp-helpers'

type Step = 'phone' | 'otp' | 'banned'

function LoginFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') ?? '/'

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [lastSendAt, setLastSendAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const confirmationRef = useRef<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)

  // 1 s tick drives the S-03 timer + resend countdown.
  useEffect(() => {
    if (step !== 'otp') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [step])

  // WebOTP auto-read — progressive enhancement; manual entry always works.
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
  }, [step])

  const secondsSinceSend = lastSendAt ? (now - lastSendAt) / 1000 : Infinity
  const codeInvalidated = wrongAttempts >= MAX_WRONG_ATTEMPTS
  const resendWait = resendWaitSeconds(secondsSinceSend, codeInvalidated)

  const sendOtp = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const auth = getFirebaseAuth()
      auth.languageCode = 'mr'
      recaptchaRef.current ??= new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      })
      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        toE164(phone),
        recaptchaRef.current,
      )
      setLastSendAt(Date.now())
      setWrongAttempts(0)
      setOtp('')
      setStep('otp')
    } catch {
      // No attempt counters exposed — avoids abuse probing (auth.md Fields note).
      setError('OTP पाठवता आला नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.')
    } finally {
      setBusy(false)
    }
  }, [phone])

  const routeAfterAuth = useCallback(async () => {
    const res = await apiFetch('/api/v1/users/me')
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

  const verifyOtp = useCallback(async () => {
    if (!confirmationRef.current || codeInvalidated) return
    setError(null)
    setBusy(true)
    try {
      await confirmationRef.current.confirm(otp)
      await routeAfterAuth()
    } catch (e) {
      if (e instanceof TypeError) {
        setError('इंटरनेट नाही. पुन्हा प्रयत्न करा.') // network loss mid-flow
      } else {
        const attempts = wrongAttempts + 1
        setWrongAttempts(attempts)
        setError(
          attempts >= MAX_WRONG_ATTEMPTS
            ? '3 वेळा चुकीचा कोड. नवीन OTP मागवा.'
            : 'चुकीचा OTP. पुन्हा प्रयत्न करा.',
        )
      }
    } finally {
      setBusy(false)
    }
  }, [codeInvalidated, otp, routeAfterAuth, wrongAttempts])

  if (step === 'banned') {
    // Full-screen banned block (BR-014): grievance contact, session signed out.
    return (
      <section aria-live="assertive">
        <h1>खाते बंद आहे</h1>
        <p>नियमांच्या उल्लंघनामुळे तुमचे खाते बंद आहे. संपर्क: support@pashusetu.in / हेल्पलाइन</p>
        <Link href="/">मुख्य पानावर परत जा</Link>
      </section>
    )
  }

  if (step === 'phone') {
    return (
      <section>
        <h1>विक्रेत्याशी बोलण्यासाठी आधी लॉगिन करा</h1>
        <p>तुमचा मोबाईल नंबर टाका. आम्ही SMS ने कोड पाठवू.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (isValidPhone(phone)) void sendOtp()
            else setError('बरोबर 10 अंकी मोबाईल नंबर टाका')
          }}
        >
          <label htmlFor="phone">मोबाईल नंबर</label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10 अंकी नंबर"
            value={phone}
            onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
            aria-invalid={!!error}
            aria-describedby={error ? 'phone-error' : undefined}
          />
          {error && (
            <p id="phone-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !isValidPhone(phone)}>
            {busy ? 'पाठवत आहे…' : 'OTP पाठवा'}
          </button>
        </form>
        <div id="recaptcha-container" />
      </section>
    )
  }

  return (
    <section>
      <h1>SMS मधील 6 अंकी कोड टाका</h1>
      <p>
        +91 {phone} वर कोड पाठवला आहे.{' '}
        <button type="button" onClick={() => setStep('phone')}>
          नंबर बदला
        </button>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void verifyOtp()
        }}
      >
        <label htmlFor="otp">OTP कोड</label>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-invalid={!!error}
          aria-describedby={error ? 'otp-error' : undefined}
        />
        {error && (
          <p id="otp-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || otp.length !== 6 || codeInvalidated}>
          {busy ? 'तपासत आहे…' : 'पुढे जा'}
        </button>
      </form>
      <button type="button" disabled={resendWait > 0 || busy} onClick={() => void sendOtp()}>
        {resendWait > 0 ? `पुन्हा पाठवा — ${resendWait} से` : 'OTP पुन्हा पाठवा'}
      </button>
      <div id="recaptcha-container" />
    </section>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginFlow />
    </Suspense>
  )
}
