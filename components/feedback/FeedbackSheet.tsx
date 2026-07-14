'use client'

// FeedbackSheet — "अडचण कळवा / सूचना द्या". A small report/suggest form in the shared
// BottomSheet, reached from the app menu. Works signed-out: apiFetch omits the auth
// header when there's no user, and the API attaches a userId only if a token is
// present. No phone is required and none is shared — this is app feedback (NFR-10),
// not listing contact, so BR-065's no-phone-in-text rule intentionally does NOT apply.

import { useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { TextField, TextArea } from '@/components/ui/Field'

type FeedbackType = 'PROBLEM' | 'SUGGESTION' | 'OTHER'
const TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'PROBLEM', label: 'अडचण' },
  { value: 'SUGGESTION', label: 'सूचना' },
  { value: 'OTHER', label: 'इतर' },
]

export function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<FeedbackType>('PROBLEM')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setType('PROBLEM')
    setMessage('')
    setContact('')
    setBusy(false)
    setDone(false)
    setError(null)
    onClose()
  }

  async function submit() {
    if (message.trim().length < 3) {
      setError('कृपया थोडक्यात तुमची अडचण किंवा सूचना लिहा.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch('/api/v1/feedback', {
        method: 'POST',
        body: JSON.stringify({
          type,
          message: message.trim(),
          contact: contact.trim() || undefined,
          path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch {
      setError('पाठवता आले नाही. कृपया पुन्हा प्रयत्न करा.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title="अडचण कळवा / सूचना द्या">
      {done ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="text-[18px] font-bold text-[var(--color-success)]">धन्यवाद! 🙏</p>
          <p className="text-[16px] text-[var(--color-text-2)]">
            तुमचा संदेश मिळाला. आम्ही तो नक्की बघू.
          </p>
          <Button onClick={close}>ठीक आहे</Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="flex flex-col gap-2">
            <p className="text-[16px] font-bold text-[var(--color-text)]">कशाबद्दल?</p>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  aria-pressed={type === t.value}
                  className={
                    'min-h-[44px] flex-1 rounded border px-3 text-[15px] font-bold ' +
                    (type === t.value
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                      : 'border-[var(--color-border-input)] text-[var(--color-text)]')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <TextArea
            label="तुमचा संदेश"
            placeholder="काय अडचण आली किंवा काय सुधारायला हवं ते लिहा"
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value)
              setError(null)
            }}
          />

          <TextField
            label="संपर्क (ऐच्छिक)"
            hint="आम्ही तुम्हाला उत्तर द्यावं असं वाटत असल्यास फोन नंबर किंवा नाव लिहा"
            maxLength={120}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />

          {error && (
            <p role="alert" className="text-[14px] text-[var(--color-error)]">
              {error}
            </p>
          )}

          <Button type="submit" loading={busy} disabled={message.trim().length < 3}>
            पाठवा
          </Button>
        </form>
      )}
    </BottomSheet>
  )
}
