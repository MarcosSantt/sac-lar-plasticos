import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-[13px] text-slate-600">
      <span>Exibindo <b className="font-semibold text-slate-800">{from}–{to}</b> de <b className="font-semibold text-slate-800">{total}</b></span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost px-2 py-1.5" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => onChange(n)} className={`h-8 min-w-8 rounded-md px-2 text-[13px] font-medium transition ${n === page ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{n}</button>
        ))}
        <button className="btn-ghost px-2 py-1.5" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  )
}
