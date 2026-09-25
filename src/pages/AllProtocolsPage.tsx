import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Inbox, SearchX, Timer } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { useProtocolFilters } from '../hooks/useProtocolFilters'
import { PageHeader } from '../components/PageHeader'
import { ProtocolFiltersBar } from '../components/ProtocolFiltersBar'
import { ProtocolTable } from '../components/ProtocolTable'
import { Pagination } from '../components/Pagination'
import { EmptyState } from '../components/EmptyState'
import { average, computeMetrics, isClosed, OPEN_STATUSES } from '../utils/protocol'
import { formatDuration } from '../utils/format'

const PAGE_SIZE = 8

export function AllProtocolsPage() {
  const { protocols, settings } = useStore()
  const sorted = useMemo(() => [...protocols].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [protocols])
  const { filters, set, reset, filtered, activeCount } = useProtocolFilters(sorted)
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [filters])

  const open = protocols.filter((p) => OPEN_STATUSES.includes(p.status))
  const urgent = open.filter((p) => p.priority === 'urgente' || p.priority === 'alta').length
  const pendingFirst = open.filter((p) => !p.messages.some((m) => m.author.role === 'agent')).length
  const firstAvg = average(protocols.map((p) => computeMetrics(p).firstResponse))
  const withinSla = protocols.filter((p) => { const f = computeMetrics(p).firstResponse; return f != null && f <= settings.firstResponseTargetMin }).length
  const answered = protocols.filter((p) => computeMetrics(p).firstResponse != null).length
  const resolved = protocols.filter((p) => isClosed(p.status)).length

  const indicators = [
    { label: 'Em aberto', value: open.length, icon: Inbox, cls: 'text-blue-600 bg-blue-50' },
    { label: 'Alta / urgente', value: urgent, icon: AlertTriangle, cls: 'text-red-600 bg-red-50' },
    { label: 'Sem 1ª resposta', value: pendingFirst, icon: Clock, cls: 'text-amber-600 bg-amber-50' },
    { label: '1ª resposta média', value: formatDuration(firstAvg), icon: Timer, cls: 'text-slate-600 bg-slate-100' },
    { label: 'Dentro da meta (SLA)', value: answered ? `${Math.round((withinSla / answered) * 100)}%` : '—', icon: CheckCircle2, cls: 'text-brand-600 bg-brand-50' },
    { label: 'Resolvidos / fechados', value: resolved, icon: CheckCircle2, cls: 'text-brand-600 bg-brand-50' },
  ]

  return (
    <div className="animate-slide-up">
      <PageHeader
        crumbs={[{ label: 'Início', to: '/' }, { label: 'Todos os Protocolos' }]}
        title="Todos os Protocolos"
        description="Visão da equipe SAC com todos os atendimentos da empresa."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {indicators.map((i) => (
          <div key={i.label} className="card flex items-center gap-3 p-3.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${i.cls}`}><i.icon className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="text-lg leading-tight font-semibold text-slate-900">{i.value}</p>
              <p className="truncate text-xs text-slate-500">{i.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <ProtocolFiltersBar filters={filters} set={set} reset={reset} activeCount={activeCount} show={['status', 'categoryId', 'priority', 'responsibleId', 'observerId', 'period']} placeholder="Nº do protocolo, assunto ou solicitante..." />
        {filtered.length ? (
          <>
            <ProtocolTable protocols={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} columns={['protocol', 'title', 'category', 'priority', 'status', 'responsible', 'observers', 'updatedAt']} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
          </>
        ) : (
          <EmptyState icon={<SearchX className="h-6 w-6" />} title="Nenhum protocolo encontrado" description="Ajuste os filtros para ampliar a busca." action={<button className="btn-secondary" onClick={reset}>Limpar filtros</button>} />
        )}
      </div>
    </div>
  )
}
