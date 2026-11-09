import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Hourglass, Inbox, MessageSquare, Plus, Timer, UserCheck } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { useMyProtocols } from '../hooks/useMyProtocols'
import { DashboardCard } from '../components/DashboardCard'
import { ProtocolTable } from '../components/ProtocolTable'
import { ProtocolCard } from '../components/ProtocolCard'
import { EmptyState } from '../components/EmptyState'
import { Avatar } from '../components/Avatar'
import { average, computeMetrics, isClosed, STATUS_BAR, STATUS_META, STATUS_ORDER } from '../utils/protocol'
import { formatDuration, formatRelative } from '../utils/format'
import { canOpenProtocol } from '../utils/access'

export function DashboardPage() {
  const { currentUser, protocols } = useStore()
  const participating = useMyProtocols()
  // Coordenadores não abrem nem atendem protocolos: o início deles mostra a carteira inteira.
  const portfolio = currentUser.role === 'coordinator'
  const mine = portfolio ? [...protocols].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : participating
  const listPath = portfolio ? '/protocolos' : '/meus-protocolos'
  const canOpen = canOpenProtocol(currentUser)
  const navigate = useNavigate()

  const count = (s: string[]) => mine.filter((p) => s.includes(p.status)).length
  const avgResponse = average(mine.map((p) => computeMetrics(p).averageResponse))
  const avgFirst = average(mine.map((p) => computeMetrics(p).firstResponse))
  const attention = mine.filter((p) => !isClosed(p.status) && (p.priority === 'urgente' || p.priority === 'alta' || p.status === 'novo')).slice(0, 3)

  const activity = mine
    .flatMap((p) => p.messages.slice(-3).map((m) => ({ m, p })))
    .sort((a, b) => b.m.createdAt.localeCompare(a.m.createdAt))
    .slice(0, 5)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const scope = portfolio ? 'da sua carteira' : currentUser.role === 'agent' ? 'atribuídos a você ou que você acompanha' : 'que você abriu ou acompanha'

  return (
    <div className="animate-slide-up">
      <div className="relative mb-6 overflow-hidden rounded-xl border border-brand-100 bg-brand-50 px-5 py-5 sm:px-6">
        <span className="absolute inset-y-0 left-0 w-1 bg-brand-600" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">SAC Lar Plásticos</p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-slate-900">{greeting}, {currentUser.name.split(' ')[0]}! Aqui está o resumo do seu atendimento.</h1>
            <p className="mt-1 text-sm text-slate-600">Indicadores dos protocolos {scope}.</p>
          </div>
          {canOpen && (
            <Link to="/novo" className="btn-primary shrink-0 px-4 py-2.5">
              <Plus className="h-4 w-4" /> Abrir novo protocolo
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <DashboardCard label="Protocolos abertos" value={count(['novo'])} hint="Aguardando triagem" tone="blue" icon={<Inbox className="h-4 w-4" />} onClick={() => navigate(`${listPath}?status=novo`)} />
        <DashboardCard label="Em atendimento" value={count(['em_atendimento'])} hint="Com a equipe SAC" tone="accent" icon={<UserCheck className="h-4 w-4" />} onClick={() => navigate(`${listPath}?status=em_atendimento`)} />
        <DashboardCard label="Aguardando cliente" value={count(['aguardando_cliente', 'aguardando_terceiro'])} hint="Inclui aguardando terceiro" tone="amber" icon={<Hourglass className="h-4 w-4" />} onClick={() => navigate(`${listPath}?status=aguardando_cliente`)} />
        <DashboardCard label="Resolvidos" value={count(['resolvido', 'fechado'])} hint="Inclui fechados" tone="green" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => navigate(`${listPath}?status=resolvido`)} />
        <DashboardCard label="Tempo médio de atendimento" value={formatDuration(avgResponse)} hint={`1ª resposta em média: ${formatDuration(avgFirst)}`} tone="slate" icon={<Timer className="h-4 w-4" />} />
      </div>

      <div className="mt-6 space-y-6">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-semibold text-slate-900">{portfolio ? 'Últimos protocolos da carteira' : 'Meus últimos protocolos'}</h2>
              <p className="text-xs text-slate-500">Clique em um protocolo para ver a tratativa completa</p>
            </div>
            <Link to={listPath} className="flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {mine.length ? (
            <ProtocolTable protocols={mine.slice(0, 6)} columns={['protocol', 'title', 'category', 'status', 'responsible', 'createdAt', 'updatedAt']} />
          ) : (
            <EmptyState icon={<Inbox className="h-6 w-6" />} title="Nenhum protocolo por aqui" description={portfolio ? 'Os protocolos abertos pelas equipes que você acompanha aparecerão nesta lista.' : 'Quando você abrir ou participar de um protocolo, ele aparecerá nesta lista.'} action={canOpen ? <Link to="/novo" className="btn-primary"><Plus className="h-4 w-4" />Abrir protocolo</Link> : undefined} />
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><AlertTriangle className="h-4 w-4 text-amber-500" />Requer atenção</h2>
            {attention.length ? (
              <div className="space-y-2.5">{attention.map((p) => <ProtocolCard key={p.id} protocol={p} />)}</div>
            ) : <p className="text-[13px] text-slate-500">Nenhum protocolo prioritário em aberto. 🎉</p>}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Distribuição por status</h2>
            <div className="space-y-2.5">
              {STATUS_ORDER.map((s) => {
                const n = mine.filter((p) => p.status === s).length
                const pct = mine.length ? (n / mine.length) * 100 : 0
                return (
                  <div key={s}>
                    <div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{STATUS_META[s].label}</span><span className="font-medium text-slate-800">{n}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${STATUS_BAR[s]} transition-all duration-500`} style={{ width: `${pct}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><MessageSquare className="h-4 w-4 text-slate-400" />Atividade recente</h2>
            <ul className="space-y-3">
              {activity.map(({ m, p }) => (
                <li key={m.id}>
                  <Link to={`/protocolos/${p.protocolNumber}`} className="flex gap-2.5 rounded-md hover:bg-slate-50">
                    <Avatar name={m.author.name} size="sm" />
                    <span className="min-w-0 text-[13px]">
                      <span className="block truncate"><b className="font-medium text-slate-800">{m.author.name}</b> <span className="text-slate-500">em {p.protocolNumber}</span></span>
                      <span className="block truncate text-slate-500">{m.content || 'Enviou anexo(s)'}</span>
                      <span className="text-[11px] text-slate-400">{formatRelative(m.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
