import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

export function FormField({ label, required, error, hint, children, htmlFor, className = '' }: {
  label: string; required?: boolean; error?: string; hint?: string; children: ReactNode; htmlFor?: string; className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label} {required && <span className="text-red-500" aria-label="obrigatório">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex animate-fade-in items-center gap-1 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" />{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}
