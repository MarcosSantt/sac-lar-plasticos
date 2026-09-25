import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Lock } from 'lucide-react'
import type { ProtocolStatus } from '../types'
import { STATUS_BAR, STATUS_META, STATUS_ORDER } from '../utils/protocol'

interface StatusSelectProps {
  value: ProtocolStatus
  onChange: (s: ProtocolStatus) => void
  disabled?: boolean
  disabledReason?: string
  align?: 'left' | 'right'
}

export function StatusSelect({ value, onChange, disabled, disabledReason, align = 'right' }: StatusSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const meta = STATUS_META[value]

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        title={disabled ? disabledReason : 'Alterar status'}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition ${
          disabled ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500' : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        <span key={value} className={`h-2.5 w-2.5 animate-pop-in rounded-full ${STATUS_BAR[value]}`} />
        {meta.label}
        {disabled ? <Lock className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div className={`absolute top-11 z-30 w-60 animate-pop-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Alterar status para</p>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => { setOpen(false); if (s !== value) onChange(s) }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-slate-50 ${s === value ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_BAR[s]}`} />
              <span className="flex-1">{STATUS_META[s].label}</span>
              {s === value && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
