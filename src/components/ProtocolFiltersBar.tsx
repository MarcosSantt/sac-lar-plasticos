import { RotateCcw, Search } from 'lucide-react'
import type { ProtocolFilters } from '../hooks/useProtocolFilters'
import { useStore } from '../store/StoreContext'
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER } from '../utils/protocol'

type FilterKey = 'status' | 'categoryId' | 'priority' | 'responsibleId' | 'observerId' | 'period'

interface Props {
  filters: ProtocolFilters
  set: <K extends keyof ProtocolFilters>(k: K, v: ProtocolFilters[K]) => void
  reset: () => void
  activeCount: number
  show: FilterKey[]
  placeholder?: string
}

export function ProtocolFiltersBar({ filters, set, reset, activeCount, show, placeholder = 'Buscar por protocolo, assunto ou solicitante...' }: Props) {
  const { categories, users, observers } = useStore()
  const sel = 'input py-2 text-[13px]'
  return (
    <div className="border-b border-slate-200 p-4">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative lg:w-80 lg:shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder={placeholder} value={filters.search} onChange={(e) => set('search', e.target.value)} />
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:flex">
          {show.includes('status') && (
            <select className={sel} value={filters.status} onChange={(e) => set('status', e.target.value as ProtocolFilters['status'])} aria-label="Status">
              <option value="">Todos os status</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          )}
          {show.includes('categoryId') && (
            <select className={sel} value={filters.categoryId} onChange={(e) => set('categoryId', e.target.value)} aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {show.includes('priority') && (
            <select className={sel} value={filters.priority} onChange={(e) => set('priority', e.target.value as ProtocolFilters['priority'])} aria-label="Prioridade">
              <option value="">Todas as prioridades</option>
              {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          )}
          {show.includes('responsibleId') && (
            <select className={sel} value={filters.responsibleId} onChange={(e) => set('responsibleId', e.target.value)} aria-label="Responsável">
              <option value="">Todos os responsáveis</option>
              {users.filter((u) => u.role === 'agent').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          {show.includes('observerId') && (
            <select className={sel} value={filters.observerId} onChange={(e) => set('observerId', e.target.value)} aria-label="Observador">
              <option value="">Qualquer observador</option>
              {observers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          {show.includes('period') && (
            <select className={sel} value={filters.period} onChange={(e) => set('period', e.target.value as ProtocolFilters['period'])} aria-label="Período">
              <option value="">Qualquer período</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
          )}
        </div>
      </div>
      {(activeCount > 0 || filters.search) && (
        <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700">
          <RotateCcw className="h-3.5 w-3.5" /> Limpar filtros {activeCount > 0 && `(${activeCount} ativo${activeCount > 1 ? 's' : ''})`}
        </button>
      )}
    </div>
  )
}
