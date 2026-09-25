export function ActiveBadge({ active, labels = ['Ativo', 'Inativo'] }: { active: boolean; labels?: [string, string] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${active ? 'bg-brand-50 text-brand-700 ring-brand-600/20' : 'bg-slate-100 text-slate-500 ring-slate-400/20'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-brand-500' : 'bg-slate-400'}`} />
      {active ? labels[0] : labels[1]}
    </span>
  )
}

export function StatusSwitch({ checked, onChange, labels = ['Ativo', 'Inativo'] }: { checked: boolean; onChange: (v: boolean) => void; labels?: [string, string] }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2.5">
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <span className="text-sm text-slate-700">{checked ? labels[0] : labels[1]}</span>
    </button>
  )
}
