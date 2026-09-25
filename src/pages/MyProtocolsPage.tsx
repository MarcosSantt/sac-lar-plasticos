import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Inbox, Plus, SearchX } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { useMyProtocols } from '../hooks/useMyProtocols'
import { useProtocolFilters } from '../hooks/useProtocolFilters'
import type { ProtocolStatus } from '../types'
import { PageHeader } from '../components/PageHeader'
import { ProtocolFiltersBar } from '../components/ProtocolFiltersBar'
import { ProtocolTable } from '../components/ProtocolTable'
import { Pagination } from '../components/Pagination'
import { EmptyState } from '../components/EmptyState'

const PAGE_SIZE = 8

export function MyProtocolsPage() {
  const { currentUser } = useStore()
  const mine = useMyProtocols()
  const { filters, set, reset, filtered, activeCount } = useProtocolFilters(mine)
  const [params] = useSearchParams()
  const [page, setPage] = useState(1)

  useEffect(() => {
    const s = params.get('status')
    if (s) set('status', s as ProtocolStatus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])
  useEffect(() => setPage(1), [filters])

  const roleText = currentUser.role === 'agent' ? 'Protocolos atribuídos a você' : currentUser.role === 'observer' ? 'Protocolos em que você é observador' : 'Protocolos abertos por você'

  return (
    <div className="animate-slide-up">
      <PageHeader
        crumbs={[{ label: 'Início', to: '/' }, { label: 'Meus Protocolos' }]}
        title="Meus Protocolos"
        description={`${roleText} · ${mine.length} no total`}
        actions={<Link to="/novo" className="btn-success"><Plus className="h-4 w-4" /> Abrir novo protocolo</Link>}
      />
      <div className="card overflow-hidden">
        <ProtocolFiltersBar filters={filters} set={set} reset={reset} activeCount={activeCount} show={['status', 'categoryId', 'priority', 'period']} />
        {filtered.length ? (
          <>
            <ProtocolTable protocols={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} columns={['protocol', 'title', 'category', 'status', 'responsible', 'updatedAt']} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
          </>
        ) : mine.length ? (
          <EmptyState icon={<SearchX className="h-6 w-6" />} title="Nenhum protocolo encontrado" description="Nenhum protocolo corresponde aos filtros aplicados." action={<button className="btn-secondary" onClick={reset}>Limpar filtros</button>} />
        ) : (
          <EmptyState icon={<Inbox className="h-6 w-6" />} title="Você ainda não tem protocolos" description="Abra um novo protocolo para começar um atendimento." action={<Link to="/novo" className="btn-primary"><Plus className="h-4 w-4" />Abrir protocolo</Link>} />
        )}
      </div>
    </div>
  )
}
