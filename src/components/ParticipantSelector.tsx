import { useState } from 'react'
import { Check, Search } from 'lucide-react'
import type { Observer } from '../types'
import { normalize } from '../utils/format'
import { Avatar } from './Avatar'

interface ParticipantSelectorProps {
  observers: Observer[]
  selected: string[]
  onChange: (ids: string[]) => void
  /** Ids que já participam e não podem ser selecionados novamente. */
  disabledIds?: string[]
}

export function ParticipantSelector({ observers, selected, onChange, disabledIds = [] }: ParticipantSelectorProps) {
  const [query, setQuery] = useState('')
  const q = normalize(query)
  const list = observers.filter((o) => o.active && normalize(`${o.name} ${o.department} ${o.email}`).includes(q))

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  return (
    <div>
      {observers.filter((o) => o.active).length > 5 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar por nome ou departamento..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {list.map((o) => {
          const already = disabledIds.includes(o.id)
          const checked = already || selected.includes(o.id)
          return (
            <button
              type="button"
              key={o.id}
              disabled={already}
              onClick={() => toggle(o.id)}
              className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 ${
                checked ? 'border-brand-300 bg-brand-50/70 ring-1 ring-brand-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              } ${already ? 'cursor-not-allowed opacity-60' : ''}`}
              aria-pressed={checked}
            >
              <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition ${checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'}`}>
                {checked && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <Avatar name={o.name} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-slate-800">{o.name}</span>
                <span className="block truncate text-xs text-slate-500">{already ? 'Já participa' : `${o.department} · ${o.email}`}</span>
              </span>
            </button>
          )
        })}
        {!list.length && <p className="col-span-full py-4 text-center text-[13px] text-slate-500">Nenhum observador encontrado.</p>}
      </div>
    </div>
  )
}
