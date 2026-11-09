import { useMemo, useState, type ReactNode } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { Avatar } from '../components/Avatar'
import { BarList } from '../components/charts/BarList'
import { ColumnChart } from '../components/charts/ColumnChart'
import { formatDuration } from '../utils/format'
import { monthLabel, monthOf, monthReport, monthlyTrend, sameMonth, shiftMonth } from '../utils/analytics'

const percent = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[13px] font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-[26px] leading-tight font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Volume, motivos e tempos de atendimento por mês (aba "Atendimento" do dashboard). */
export function IndicatorsPage({ embedded = false }: { embedded?: boolean }) {
  const { protocols, categories, users, settings } = useStore()
  const current = monthOf(new Date())
  const [month, setMonth] = useState(current)
  const target = settings.firstResponseTargetMin

  const agents = useMemo(() => users.filter((u) => u.role === 'agent'), [users])
  const report = useMemo(() => monthReport(protocols, month, { categories, agents, targetMin: target }), [protocols, month, categories, agents, target])
  const trend = useMemo(() => monthlyTrend(protocols, month), [protocols, month])

  const delta = report.openedBefore ? (report.opened - report.openedBefore) / report.openedBefore : null
  const top = report.byCategory[0]
  const peak = Math.max(...report.daily)
  const peakDay = report.daily.indexOf(peak)
  const lastDay = report.daily.length

  return (
    <div className="animate-slide-up">
      {(() => {
        const switcher = (
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <button className="btn-ghost px-2 py-1.5" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[9.5rem] text-center text-[13px] font-medium text-slate-800 capitalize">{monthLabel(month)}</span>
            <button className="btn-ghost px-2 py-1.5 disabled:opacity-40" disabled={sameMonth(month, current)} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )
        return embedded
          ? <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Volume, motivos e tempos de atendimento por mês.</p>{switcher}</div>
          : <PageHeader crumbs={[{ label: 'Início', to: '/' }, { label: 'Dashboard' }]} title="Dashboard do SAC" description="Volume, motivos e tempos de atendimento por mês." actions={switcher} />
      })()}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile
          label="SACs abertos"
          value={report.opened}
          hint={delta == null ? 'Sem base no mês anterior' : (
            <span className="inline-flex items-center gap-1">
              {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {delta >= 0 ? '+' : ''}{Math.round(delta * 100)}% vs. mês anterior ({report.openedBefore})
            </span>
          )}
        />
        <Tile label="Encerrados no mês" value={report.resolved} hint={`${percent(report.resolutionRate)} dos abertos no mês já resolvidos`} />
        <Tile label="1ª resposta média" value={formatDuration(report.firstResponse)} hint={`Meta: ${formatDuration(target)}`} />
        <Tile label="Dentro da meta" value={percent(report.withinTarget)} hint="1ª resposta dentro do prazo" />
        <Tile label="Tempo até encerrar" value={formatDuration(report.resolutionTime)} hint="Média dos encerrados no mês" />
        <Tile label="Em aberto hoje" value={report.backlog} hint="Todos os meses" />
      </div>

      {report.opened === 0 && report.resolved === 0 ? (
        <div className="card mt-6">
          <EmptyState icon={<BarChart3 className="h-6 w-6" />} title={`Nenhum protocolo em ${monthLabel(month)}`} description="Escolha outro mês para ver os indicadores." />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel
            title="Motivos de SAC no mês"
            subtitle={top ? `Principal motivo: ${top.label}, com ${top.value} de ${report.opened} protocolos (${Math.round((top.value / report.opened) * 100)}%)` : 'Protocolos abertos por categoria'}
          >
            {report.byCategory.length ? <BarList items={report.byCategory} emphasizeFirst /> : <p className="text-[13px] text-slate-500">Nenhum protocolo aberto neste mês.</p>}
          </Panel>

          <Panel title="Abertos x encerrados" subtitle="Últimos 6 meses">
            <ColumnChart
              labels={trend.map((t) => t.label)}
              series={[
                { name: 'Abertos', color: 'bg-brand-600', values: trend.map((t) => t.opened) },
                { name: 'Encerrados', color: 'bg-blue-500', values: trend.map((t) => t.resolved) },
              ]}
            />
          </Panel>

          <Panel title="Aberturas por dia" subtitle={peak > 0 ? `Pico no dia ${peakDay + 1}, com ${peak} protocolo(s)` : undefined} className="lg:col-span-2">
            <ColumnChart
              height={140}
              labels={report.daily.map((_, i) => String(i + 1))}
              series={[{ name: 'Abertos', color: 'bg-brand-600', values: report.daily }]}
              showLabel={(i) => i === 0 || (i + 1) % 5 === 0 || i === lastDay - 1}
              showValue={(_, i) => i === peakDay}
              describe={(i) => `Dia ${i + 1}: ${report.daily[i]} protocolo(s) aberto(s)`}
            />
          </Panel>

          <Panel title="Por tipo de solicitação" subtitle="Protocolos abertos no mês">
            <BarList items={report.byType} />
          </Panel>

          <Panel title="Por prioridade" subtitle="Protocolos abertos no mês">
            <BarList items={report.byPriority} />
          </Panel>

          <Panel title="Equipe SAC" subtitle="Protocolos do mês por responsável" className="lg:col-span-2">
            {report.agents.length ? (
              <div className="-mx-5 -mb-5 overflow-x-auto">
                <table className="w-full">
                  <thead className="border-y border-slate-200 bg-slate-50/70">
                    <tr>
                      <th className="th">Atendente</th><th className="th text-right">Recebidos no mês</th><th className="th text-right">Encerrados no mês</th>
                      <th className="th text-right">Em aberto hoje</th><th className="th text-right">1ª resposta média</th><th className="th text-right">Dentro da meta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.agents.map((a) => (
                      <tr key={a.id}>
                        <td className="td"><span className="flex items-center gap-2.5 font-medium whitespace-nowrap text-slate-900"><Avatar name={a.name} size="sm" />{a.name}</span></td>
                        <td className="td text-right tabular-nums">{a.assigned}</td>
                        <td className="td text-right tabular-nums">{a.resolved}</td>
                        <td className="td text-right tabular-nums">{a.open}</td>
                        <td className="td text-right tabular-nums">{formatDuration(a.firstResponse)}</td>
                        <td className="td text-right tabular-nums">{percent(a.withinTarget)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-[13px] text-slate-500">Nenhum protocolo atribuído neste mês.</p>}
          </Panel>
        </div>
      )}
    </div>
  )
}
