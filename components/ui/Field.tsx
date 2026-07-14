// Field — labeled input/select wrapper. Design tokens §Component sizes
// (--h-input 52px, body-lg 18px input values). Every input carries a visible
// label (design hard rule 5); errors render in --color-error with role=alert
// (never color alone — the message text carries the meaning, accessibility).

'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils/cn'

const controlBase =
  'w-full min-h-[var(--h-input)] rounded border px-4 text-[18px] leading-[1.6] ' +
  'bg-[var(--color-surface)] text-[var(--color-text)] ' +
  'border-[var(--color-border-input)] placeholder:text-[var(--color-text-3)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-0 ' +
  'focus-visible:outline-[var(--color-primary)] aria-[invalid=true]:border-[var(--color-error)]'

type BaseProps = {
  label: string
  error?: string | null
  hint?: string
}

export function TextField({
  label,
  error,
  hint,
  className,
  id,
  suggestions,
  ...rest
}: BaseProps & { suggestions?: string[] } & React.InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errId = `${fieldId}-err`
  // Native combobox: a <datalist> suggests values but the user can still free-type
  // anything (used for taluka, where there is no canonical master list).
  const listId = suggestions && suggestions.length ? `${fieldId}-list` : undefined
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-[16px] font-bold text-[var(--color-text)]">
        {label}
      </label>
      {hint && <p className="text-[14px] text-[var(--color-text-2)]">{hint}</p>}
      <input
        id={fieldId}
        className={cn(controlBase, className)}
        aria-invalid={!!error}
        aria-describedby={error ? errId : undefined}
        list={listId}
        {...rest}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions!.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {error && (
        <p id={errId} role="alert" className="text-[14px] text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  )
}

export function SelectField({
  label,
  error,
  hint,
  className,
  id,
  children,
  ...rest
}: BaseProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errId = `${fieldId}-err`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-[16px] font-bold text-[var(--color-text)]">
        {label}
      </label>
      {hint && <p className="text-[14px] text-[var(--color-text-2)]">{hint}</p>}
      <select
        id={fieldId}
        className={cn(controlBase, className)}
        aria-invalid={!!error}
        aria-describedby={error ? errId : undefined}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p id={errId} role="alert" className="text-[14px] text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextArea({
  label,
  error,
  hint,
  className,
  id,
  ...rest
}: BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errId = `${fieldId}-err`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="text-[16px] font-bold text-[var(--color-text)]">
        {label}
      </label>
      {hint && <p className="text-[14px] text-[var(--color-text-2)]">{hint}</p>}
      <textarea
        id={fieldId}
        className={cn(controlBase, 'py-3', className)}
        aria-invalid={!!error}
        aria-describedby={error ? errId : undefined}
        {...rest}
      />
      {error && (
        <p id={errId} role="alert" className="text-[14px] text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  )
}
