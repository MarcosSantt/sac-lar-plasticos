import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, UserCheck } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import type { Protocol } from '../types'
import { PageHeader } from '../components/PageHeader'
import { Avatar } from '../components/Avatar'
import { PriorityBadge } from '../components/PriorityBadge'
import { EmptyState } from '../components/EmptyState'
import { formatDuration } from '../utils/format'
import { STAGE_META, STAGE_ORDER, workflowOf, type WorkflowItem } from '../utils/workflow'

const UNASSIGNED = 'sem-responsavel'

export function WorkflowPage() {
  const { protocols, users, settings, getUser } = useStore()
  const [responsible, setResponsible] = useState('')
  const target = settings.firstResponseTargetMin

  // `protocols` é recarregado periodicamente, o que também atualiza os tempos de espera.
  const items = useMemo(() => {
    const now = Date.now()
    return protocols.map((p) => workflowOf(p, now, target)).filter((i): i is WorkflowItem => i !== null)
  }, [protocols, target])

  // Carga por pessoa: quantas tratativas cada atendente tem e em quantas deve resposta.
  const team = useMemo(() => {
    const rows = users.filter((u) => u.role === 'agent' && u.active).map((u) => ({ id: u.id, name: u.name }))
    if (items.some((i) => !i.protocol.responsibleId)) rows.push({ id: UNASSIGNED, name: 'Sem responsável' })
    return rows.map((r) => {
      const mine = items.filter((i) => (i.protocol.responsibleId ?? UNASSIGNED) === r.id)
      return { ...r, total: mine.length, owes: mine.filter((i) => i.stage === 'sac_owes').length, late: mine.filter((i) => i.late).length }
    }).sort((a, b) => b.owes - a.owes || b.total - a.total || a.name.localeCompare(b.name))
  }, [items, users])

  const visible = responsible ? items.filter((i) => (i.protocol.responsibleId ?? UNASSIGNED) === responsible) : items
  const owing = items.filter((i) => i.stage === 'sac_owes')

  /** Com quem está a tratativa e por quê. */
  const holder = (i: WorkflowItem): { name: string; role: string } => {
    const agent = getUser(i.protocol.responsibleId)
    if (i.stage === 'requester') return { name: i.protocol.requester.name, role: 'Solicitante' }
    if (i.stage === 'third') return { name: agent?.name ?? 'Sem responsável', role: 'acompanha o terceiro' }
    return { name: agent?.name ?? 'Sem responsável', role: agent ? 'Equipe SAC' : 'aguardando atribuição' }
  }

  const lastMessage = (p: Protocol) => p.messages[p.messages.length - 1]

  return (
    <div className="animate-slide-up">
      <PageHeader
        crumbs={[{ label: 'Início', to: '/' }, { label: 'Workflow' }]}
        title="Workflow das tratativas"
        description={`${items.length} protocolo(s) em aberto · ${owing.length} com resposta pendente do SAC · meta de resposta: ${formatDuration(target)}`}
      />

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Nenhuma tratativa em aberto" description="Quando houver protocolos em andamento, eles aparecem aqui organizados por quem está com a vez." />
        </div>
      ) : (
        <>
          <section className="mb-5" aria-label="Carga por pessoa">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Com quem estão</h2>
              {responsible && <button onClick={() => setResponsible('')} className="text-xs font-medium text-brand-600 hover:text-brand-700">Mostrar todos</button>}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {team.map((t) => {
                const active = responsible === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setResponsible(active ? '' : t.id)}
                    aria-pressed={active}
                    className={`card flex min-w-[220px] shrink-0 items-center gap-3 p-3 text-left transition ${active ? 'border-brand-400 ring-1 ring-brand-300' : 'hover:border-brand-300'}`}
                  >
                    <Avatar name={t.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900">{t.name}</span>
                      <span className="block text-xs text-slate-500">{t.total} em aberto</span>
                    </span>
                    <span className="text-right">
                      <span className={`block text-lg leading-none font-semibold tabular-nums ${t.owes ? 'text-slate-900' : 'text-slate-400'}`}>{t.owes}</span>
                      <span className="block text-[10px] text-slate-500">deve resposta</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STAGE_ORDER.map((stage) => {
              const meta = STAGE_META[stage]
              // O que espera há mais tempo aparece primeiro.
              const column = visible.filter((i) => i.stage === stage).sort((a, b) => b.waitingMin - a.waitingMin)
              return (
                <section key={stage} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50/70">
                  <header className="border-b border-slate-200 px-3.5 py-3">
                    <h2 className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />{meta.title}
                      <span className="ml-auto rounded-full bg-white px-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{column.length}</span>
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">{meta.description}</p>
                  </header>
                  <ul className="flex-1 space-y-2.5 p-2.5">
                    {column.length === 0 && <li className="px-2 py-6 text-center text-xs text-slate-400">Nada por aqui.</li>}
                    {column.map((i) => {
                      const p = i.protocol
                      const who = holder(i)
                      const last = lastMessage(p)
                      return (
                        <li key={p.id}>
                          <Link to={`/protocolos/${p.protocolNumber}`} className="card block p-3 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md hover:shadow-brand-900/5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-brand-700">{p.protocolNumber}</span>
                              <PriorityBadge priority={p.priority} />
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-[13px] font-medium text-slate-900">{p.title}</p>

                            <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                              <UserCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="text-[11px] text-slate-500">Com</span>
                              <Avatar name={who.name} size="xs" />
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] font-medium text-slate-800">{who.name}</span>
                                <span className="block truncate text-[11px] text-slate-500">{who.role}</span>
                              </span>
                            </div>

                            {last && (
                              <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="line-clamp-2"><b className="font-medium text-slate-700">{last.author.name}:</b> {last.content || 'enviou anexo(s)'}</span>
                              </p>
                            )}

                            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                              <span className="truncate text-slate-500">Solicitante: {p.requester.name}</span>
                              {i.late ? (
                                <span className="flex shrink-0 items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 font-medium text-red-700" title={`Sem resposta do SAC há mais que a meta de ${formatDuration(target)}`}>
                                  <AlertTriangle className="h-3.5 w-3.5" /> há {formatDuration(i.waitingMin)}
                                </span>
                              ) : (
                                <span className="flex shrink-0 items-center gap-1 text-slate-600"><Clock className="h-3.5 w-3.5 text-slate-400" /> há {formatDuration(i.waitingMin)}</span>
                              )}
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
