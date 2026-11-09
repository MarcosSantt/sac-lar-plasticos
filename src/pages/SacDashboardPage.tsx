import { useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, BarChart3, RotateCcw, Table2, Target } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { LineChart } from '../components/charts/LineChart'
import { RankList } from '../components/charts/RankList'
import { ColumnChart } from '../components/charts/ColumnChart'
import { IndicatorsPage } from './IndicatorsPage'
import { formatMoney } from '../utils/format'
import { COST_LABEL } from '../utils/items'
import { isSacTeam } from '../utils/access'
import {
  FC_MODE, MONTHS_SHORT, UNCLASSIFIED, goalsReport, monitoring, occurrencesOf, type DashboardFilters, type GoalsReport,
  type MonitoringReport, type Ranked,
} from '../utils/sacDashboard'
import type { ItemCosts } from '../types'

const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const num = (v: number) => v.toLocaleString('pt-BR')
const pct = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString('pt-BR')}%`
const money = (v: number) => formatMoney(v, true)

interface TableView { columns: string[]; rows: (string | number)[][] }

/** Cartão de gráfico com alternância para a tabela equivalente. */
function Panel({ title, subtitle, table, children, className = '' }: { title: string; subtitle?: string; table?: TableView; children: ReactNode; className?: string }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className={`card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {table && (
          <button onClick={() => setAsTable((v) => !v)} className="btn-ghost -mt-1 -mr-2 shrink-0 px-2 py-1 text-xs" aria-pressed={asTable}>
            {asTable ? <><BarChart3 className="h-3.5 w-3.5" /> Gráfico</> : <><Table2 className="h-3.5 w-3.5" /> Tabela</>}
          </button>
        )}
      </div>
      <div className="mt-4">
        {asTable && table ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-slate-200">{table.columns.map((c, i) => <th key={c} className={`py-1.5 font-medium text-slate-500 ${i ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={`py-1.5 ${j ? 'text-right tabular-nums text-slate-800' : 'text-slate-700'}`}>{v}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        ) : children}
      </div>
    </section>
  )
}

const rankTable = (items: Ranked[], label: string, format = num, share = true): TableView => ({
  columns: share ? [label, 'Qtd', '%'] : [label, 'Total'],
  rows: items.map((i) => (share ? [i.label, format(i.value), pct(i.share)] : [i.label, format(i.value)])),
})

function Tile({ label, value, hint, children }: { label: string; value: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[13px] font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children}
    </div>
  )
}

/** Barra única aberto × fechado (dois segmentos com intervalo de 2px). */
function StatusSplit({ open, closed }: { open: number; closed: number }) {
  const total = open + closed
  if (!total) return null
  return (
    <div className="mt-3">
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded">
        {closed > 0 && <span className="h-full bg-brand-600" style={{ width: `${(closed / total) * 100}%` }} title={`Fechados: ${closed}`} />}
        {open > 0 && <span className="h-full bg-blue-500" style={{ width: `${(open / total) * 100}%` }} title={`Abertos: ${open}`} />}
      </div>
      <ul className="mt-2 flex gap-4 text-xs text-slate-600">
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />Fechados <b className="font-semibold text-slate-900">{pct(closed / total)}</b></li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Abertos <b className="font-semibold text-slate-900">{pct(open / total)}</b></li>
      </ul>
    </div>
  )
}

function Meter({ label, value, limit }: { label: string; value: number; limit: number | null }) {
  const ratio = limit ? value / limit : 0
  const tone = ratio >= 1 ? 'bg-red-500' : ratio >= 0.85 ? 'bg-amber-500' : 'bg-brand-600'
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-900"><b className="font-semibold">{num(value)}</b><span className="text-slate-500"> de {limit == null ? '—' : num(limit)}</span></span>
      </div>
      <div className="h-2.5 overflow-hidden rounded bg-slate-100">
        <div className={`h-full rounded-r ${tone} transition-all duration-500`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
        {limit ? <>{ratio >= 1 && <AlertCircle className="h-3.5 w-3.5 text-red-600" />}{pct(ratio)} do limite do ano{ratio >= 1 ? ' — limite ultrapassado' : ratio >= 0.85 ? ' — atenção' : ''}</> : 'Meta não cadastrada para este ano'}
      </p>
    </div>
  )
}

function Monitoring({ report, filters }: { report: MonitoringReport; filters: DashboardFilters }) {
  const period = filters.month ? `${MONTHS_LONG[filters.month - 1]} de ${filters.year}` : String(filters.year)
  if (!report.occurrences && !report.byMonth.some(Boolean)) {
    return <div className="card"><EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Nenhuma ocorrência no período" description="Ajuste os filtros ou escolha outro ano." /></div>
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Ocorrências de SAC" value={num(report.occurrences)} hint={`${num(report.protocols)} protocolo(s) · ${num(report.quantity)} unidade(s) · ${period}`} />
        <Tile label="Status" value={num(report.open)} hint="ocorrências em aberto"><StatusSplit open={report.open} closed={report.closed} /></Tile>
        <Tile label="Custo total" value={formatMoney(report.totalCost)}>
          <dl className="mt-2 space-y-0.5 text-xs">
            {(Object.keys(COST_LABEL) as (keyof ItemCosts)[]).map((k) => (
              <div key={k} className="flex justify-between gap-2"><dt className="text-slate-500">{COST_LABEL[k]}</dt><dd className="tabular-nums text-slate-800">{formatMoney(report.costs[k])}</dd></div>
            ))}
          </dl>
        </Tile>
        <Tile
          label="Aguardando classificação"
          value={num(report.unclassified)}
          hint={report.unclassified ? 'Itens sem modo de falha ou área — ficam fora dos rankings até o SAC classificar' : 'Todos os itens do período estão classificados'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel
          title="Monitoramento"
          subtitle={`Ocorrências por mês em ${filters.year}${filters.month ? ` · ${MONTHS_LONG[filters.month - 1]} em destaque` : ''}`}
          className="lg:col-span-2"
          table={{ columns: ['Mês', 'Ocorrências'], rows: MONTHS_SHORT.map((m, i) => [m, report.byMonth[i] == null ? '—' : num(report.byMonth[i]!)]) }}
        >
          <LineChart labels={MONTHS_SHORT} values={report.byMonth} name="ocorrências" highlight={filters.month ? filters.month - 1 : null} />
        </Panel>
        <Panel title="Top 5 ocorrências por setor" subtitle="Área responsável" table={rankTable(report.byArea, 'Setor')}>
          <RankList items={report.byArea} />
        </Panel>
        <Panel title="Top 5 modos de falha" table={rankTable(report.byMode, 'Modo de falha')}><RankList items={report.byMode} /></Panel>
        <Panel title="Top 5 por família de produtos" table={rankTable(report.byFamily, 'Família')}><RankList items={report.byFamily} /></Panel>
        <Panel title="Top 5 por produtos" table={rankTable(report.byProduct, 'Produto')}><RankList items={report.byProduct} /></Panel>
        <Panel title="Top 5 por clientes" table={rankTable(report.byCustomer, 'Cliente')}><RankList items={report.byCustomer} /></Panel>
        <Panel title="Top 5 custo por área" table={rankTable(report.costByArea, 'Área', formatMoney, false)}>
          <RankList items={report.costByArea} format={money} showShare={false} empty="Nenhum custo lançado no período." />
        </Panel>
        <Panel title="Top 5 custo por modo de falha" table={rankTable(report.costByMode, 'Modo de falha', formatMoney, false)}>
          <RankList items={report.costByMode} format={money} showShare={false} empty="Nenhum custo lançado no período." />
        </Panel>
      </div>
    </div>
  )
}

function Goals({ report, year }: { report: GoalsReport; year: number }) {
  const g = report.goals
  const ppmDigits = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const tons = report.kg.map((k) => (k == null ? 0 : Math.round(k / 1000)))
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-brand-600" />
        <h2 className="text-base font-semibold text-slate-900">Objetivos e metas · {year}</h2>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="card p-5">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Objetivo</p>
          <p className="mt-1 text-[13px] text-slate-700">Reduzir o número de reclamações (SAC) de clientes.</p>
          {g ? (
            <>
              <p className="mt-4 text-xs font-semibold tracking-wide text-brand-700 uppercase">Metas</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-slate-700">
                <li>Reduzir em {num(g.sacReductionPct)}% o número de SAC de {year - 1} ({num(g.prevSac)}) — limite de <b className="font-semibold">{num(report.sacLimit!)}</b></li>
                <li>Reduzir em {num(g.fcReductionPct)}% os SAC de falta de componente de {year - 1} ({num(g.prevFc)}) — limite de <b className="font-semibold">{num(report.fcLimit!)}</b></li>
              </ul>
              <div className="mt-5 space-y-4">
                <Meter label="SAC acumulado" value={report.sacTotal} limit={report.sacLimit} />
                <Meter label="Falta de componente (FC)" value={report.fcTotal} limit={report.fcLimit} />
              </div>
            </>
          ) : <p className="mt-4 text-[13px] text-slate-500">As metas de {year} ainda não foram cadastradas em Administração › Metas e produção.</p>}
        </section>
        <Panel
          title="SAC e falta de componente por mês"
          subtitle="Ocorrências no mês"
          className="lg:col-span-2"
          table={{ columns: ['Mês', 'SAC', 'FC'], rows: MONTHS_SHORT.map((m, i) => [m, num(report.sac[i]), num(report.fc[i])]) }}
        >
          <ColumnChart
            labels={MONTHS_SHORT}
            series={[{ name: 'SAC (geral)', color: 'bg-brand-600', values: report.sac }, { name: 'Falta de componente', color: 'bg-blue-500', values: report.fc }]}
            showValue={() => false}
            describe={(i) => `${MONTHS_LONG[i]}: ${report.sac[i]} SAC · ${report.fc[i]} falta de componente`}
          />
        </Panel>
        <Panel
          title="PPM de SAC"
          subtitle="Ocorrências por milhão de kg produzidos"
          className="lg:col-span-2"
          table={{ columns: ['Mês', 'PPM', 'Produção (t)'], rows: MONTHS_SHORT.map((m, i) => [m, report.ppm[i] == null ? '—' : ppmDigits(report.ppm[i]!), report.kg[i] == null ? '—' : num(tons[i])]) }}
        >
          {report.ppm.some((v) => v != null) ? (
            <LineChart
              labels={MONTHS_SHORT}
              values={report.ppm}
              name="PPM"
              format={ppmDigits}
              references={[
                ...(g?.prevPpm ? [{ label: `PPM ${year - 1}`, value: g.prevPpm }] : []),
                ...(report.ppmTarget ? [{ label: 'Meta', value: report.ppmTarget }] : []),
              ]}
            />
          ) : <p className="py-8 text-center text-[13px] text-slate-500">Lance a produção mensal em Administração › Metas e produção para calcular o PPM.</p>}
          {report.ppmAverage != null && <p className="mt-2 text-xs text-slate-500">Média de {year}: <b className="font-semibold text-slate-800">{ppmDigits(report.ppmAverage)}</b></p>}
        </Panel>
        <Panel title="Produção" subtitle="Plástico produzido no mês (t)" table={{ columns: ['Mês', 'Toneladas'], rows: MONTHS_SHORT.map((m, i) => [m, report.kg[i] == null ? '—' : num(tons[i])]) }}>
          <ColumnChart
            labels={MONTHS_SHORT.map((m) => m[0])}
            series={[{ name: 'Produção (t)', color: 'bg-slate-400', values: tons }]}
            showValue={() => false}
            describe={(i) => `${MONTHS_LONG[i]}: ${report.kg[i] == null ? 'não lançada' : `${num(tons[i])} t`}`}
          />
        </Panel>
      </div>
    </div>
  )
}

export function SacDashboardPage() {
  const { protocols, lookups, teams, goals, production, currentUser } = useStore()
  const [tab, setTab] = useState<'monitoramento' | 'atendimento'>('monitoramento')
  const now = new Date()
  const initial: DashboardFilters = { year: now.getFullYear(), month: null, area: '', mode: '', concession: 'all', teamId: '' }
  const [filters, setFilters] = useState<DashboardFilters>(initial)
  const set = <K extends keyof DashboardFilters>(k: K, v: DashboardFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))

  const all = useMemo(() => occurrencesOf(protocols), [protocols])
  const report = useMemo(() => monitoring(all, filters), [all, filters])
  const goalsData = useMemo(
    () => goalsReport(all, filters.year, goals.find((g) => g.year === filters.year), production, filters.teamId),
    [all, filters.year, filters.teamId, goals, production],
  )

  const years = useMemo(() => [...new Set([now.getFullYear(), ...all.map((o) => o.year), ...goals.map((g) => g.year)])].sort((a, b) => b - a), [all, goals]) // eslint-disable-line react-hooks/exhaustive-deps
  const options = (kind: 'area' | 'failure_mode', used: string[]) =>
    [...new Set([...lookups.filter((l) => l.kind === kind && l.active).map((l) => l.name), ...used.filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'pt'))
  const areaOptions = options('area', all.map((o) => o.item.responsibleArea))
  const modeOptions = options('failure_mode', all.map((o) => o.item.failureMode))
  // Equipes que a pessoa enxerga: todas para o SAC; as vinculadas para coordenadores e pós-vendas.
  const sac = isSacTeam(currentUser)
  const visibleTeams = teams.filter((t) => sac || currentUser.teamIds.includes(t.id))
  const active = filters.month != null || !!filters.area || !!filters.mode || filters.concession !== 'all' || !!filters.teamId
  const scope = sac ? 'Todos os protocolos da empresa.' : 'Protocolos das equipes que você acompanha.'

  return (
    <div className="animate-slide-up">
      <PageHeader
        crumbs={[{ label: 'Início', to: '/' }, { label: 'Dashboard' }]}
        title="Dashboard do SAC"
        description={`Monitoramento de ocorrências, custos e metas. ${scope}`}
        actions={
          <div className="flex rounded-lg border border-slate-200 bg-white p-1" role="tablist">
            {([['monitoramento', 'Monitoramento'], ['atendimento', 'Atendimento']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${tab === id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
            ))}
          </div>
        }
      />

      {tab === 'atendimento' ? <IndicatorsPage embedded /> : (
        <div className="space-y-6">
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <label className="w-28"><span className="label">Ano</span>
              <select className="input" value={filters.year} onChange={(e) => set('year', Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
            </label>
            <label className="w-36"><span className="label">Mês</span>
              <select className="input" value={filters.month ?? ''} onChange={(e) => set('month', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Ano inteiro</option>
                {MONTHS_LONG.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
            {visibleTeams.length > 1 && (
              <label className="w-48"><span className="label">Equipe</span>
                <select className="input" value={filters.teamId} onChange={(e) => set('teamId', e.target.value)}>
                  <option value="">Todas</option>
                  {visibleTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            )}
            <label className="w-56"><span className="label">Área responsável</span>
              <select className="input" value={filters.area} onChange={(e) => set('area', e.target.value)}>
                <option value="">Todas</option>
                {areaOptions.map((a) => <option key={a}>{a}</option>)}
                <option value={UNCLASSIFIED}>{UNCLASSIFIED}</option>
              </select>
            </label>
            <label className="w-56"><span className="label">Modo de falha</span>
              <select className="input" value={filters.mode} onChange={(e) => set('mode', e.target.value)}>
                <option value="">Todos</option>
                {modeOptions.map((m) => <option key={m}>{m}</option>)}
                <option value={UNCLASSIFIED}>{UNCLASSIFIED}</option>
              </select>
            </label>
            <label className="w-40"><span className="label">Concessão comercial</span>
              <select className="input" value={filters.concession} onChange={(e) => set('concession', e.target.value as DashboardFilters['concession'])}>
                <option value="all">Todas</option><option value="yes">Sim</option><option value="no">Não</option>
              </select>
            </label>
            {active && <button className="btn-ghost mb-0.5 text-[13px]" onClick={() => setFilters({ ...initial, year: filters.year })}><RotateCcw className="h-3.5 w-3.5" /> Limpar filtros</button>}
          </div>

          <Monitoring report={report} filters={filters} />
          {sac
            ? <Goals report={goalsData} year={filters.year} />
            : <p className="text-xs text-slate-500">As metas de SAC e o PPM são da empresa inteira e aparecem para a equipe SAC. Os números acima consideram apenas a sua carteira.</p>}
          <p className="text-xs text-slate-500">Cada item reclamado conta como uma ocorrência, como na planilha FR-134. A falta de componente considera o modo de falha “{FC_MODE}”.</p>
        </div>
      )}
    </div>
  )
}
