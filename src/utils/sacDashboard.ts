import type { ItemCosts, MonthProduction, Protocol, ProtocolItem, YearGoals } from '../types'
import { isClosed } from './protocol'
import { itemTotal } from './items'

/**
 * Indicadores do painel de monitoramento (equivalente à aba PAINEL da planilha FR-134).
 * Cada item reclamado é uma ocorrência: é o que a planilha conta como "SAC".
 */

export const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const FC_MODE = 'FALTA DE COMPONENTE'
export const UNCLASSIFIED = 'Não classificado'

export interface DashboardFilters {
  year: number
  /** 1–12; nulo = ano inteiro. */
  month: number | null
  area: string
  mode: string
  concession: 'all' | 'yes' | 'no'
  teamId: string
}

export interface Occurrence { item: ProtocolItem; protocol: Protocol; month: number; year: number }

export interface Ranked { key: string; label: string; value: number; share: number }

const isFuture = (year: number, month: number) => {
  const now = new Date()
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)
}

const dateParts = (iso: string) => { const d = new Date(iso); return { year: d.getFullYear(), month: d.getMonth() + 1 } }

export function occurrencesOf(protocols: Protocol[]): Occurrence[] {
  return protocols.flatMap((p) => {
    const { year, month } = dateParts(p.createdAt)
    return p.items.map((item) => ({ item, protocol: p, year, month }))
  })
}

/** Filtros de classificação e equipe (não de período). */
function matches(o: Occurrence, f: DashboardFilters) {
  if (f.teamId && o.protocol.teamId !== f.teamId) return false
  if (f.area && (o.item.responsibleArea || UNCLASSIFIED) !== f.area) return false
  if (f.mode && (o.item.failureMode || UNCLASSIFIED) !== f.mode) return false
  if (f.concession === 'yes' && !o.item.commercialConcession) return false
  if (f.concession === 'no' && o.item.commercialConcession) return false
  return true
}

function rank(list: Occurrence[], key: (o: Occurrence) => string, weight: (o: Occurrence) => number = () => 1, limit = 5): Ranked[] {
  const totals = new Map<string, number>()
  let all = 0
  for (const o of list) {
    const w = weight(o)
    all += w
    const k = key(o)
    if (!k) continue
    totals.set(k, (totals.get(k) ?? 0) + w)
  }
  return [...totals]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt'))
    .slice(0, limit)
    .map(([k, v]) => ({ key: k, label: k, value: v, share: all ? v / all : 0 }))
}

const sumCosts = (list: Occurrence[]): ItemCosts =>
  list.reduce((c, { item }) => ({
    product: c.product + item.costs.product,
    pickup: c.pickup + item.costs.pickup,
    shipping: c.shipping + item.costs.shipping,
    postal: c.postal + item.costs.postal,
  }), { product: 0, pickup: 0, shipping: 0, postal: 0 })

export function monitoring(all: Occurrence[], f: DashboardFilters) {
  const inYear = all.filter((o) => o.year === f.year && matches(o, f))
  const selected = f.month ? inYear.filter((o) => o.month === f.month) : inYear
  const costs = sumCosts(selected)
  const closed = selected.filter((o) => isClosed(o.protocol.status)).length
  const unclassified = selected.filter((o) => !o.item.failureMode || !o.item.responsibleArea).length
  return {
    occurrences: selected.length,
    protocols: new Set(selected.map((o) => o.protocol.id)).size,
    quantity: selected.reduce((sum, o) => sum + o.item.quantity, 0),
    unclassified,
    open: selected.length - closed,
    closed,
    costs,
    totalCost: costs.product + costs.pickup + costs.shipping + costs.postal,
    /** O monitoramento mensal mostra sempre o ano inteiro, com o mês filtrado em destaque; meses futuros ficam sem dado. */
    byMonth: MONTHS_SHORT.map((_, i) => (isFuture(f.year, i + 1) ? null : inYear.filter((o) => o.month === i + 1).length)),
    byArea: rank(selected, (o) => o.item.responsibleArea),
    byMode: rank(selected, (o) => o.item.failureMode),
    byFamily: rank(selected, (o) => o.item.family),
    byProduct: rank(selected, (o) => o.item.productName),
    byCustomer: rank(selected, (o) => o.protocol.customerName),
    costByArea: rank(selected, (o) => o.item.responsibleArea, (o) => itemTotal(o.item.costs)),
    costByMode: rank(selected, (o) => o.item.failureMode, (o) => itemTotal(o.item.costs)),
  }
}

export type MonitoringReport = ReturnType<typeof monitoring>

/** Objetivos e metas do ano: limites de SAC e de falta de componente (FC) e PPM. */
export function goalsReport(all: Occurrence[], year: number, goals: YearGoals | undefined, production: MonthProduction[], teamId: string) {
  const inYear = all.filter((o) => o.year === year && (!teamId || o.protocol.teamId === teamId))
  const sac = MONTHS_SHORT.map((_, i) => inYear.filter((o) => o.month === i + 1).length)
  const fc = MONTHS_SHORT.map((_, i) => inYear.filter((o) => o.month === i + 1 && o.item.failureMode === FC_MODE).length)
  const kg = MONTHS_SHORT.map((_, i) => production.find((p) => p.year === year && p.month === i + 1)?.kg ?? null)
  // PPM = ocorrências do mês por milhão de kg produzidos (só nos meses com produção lançada).
  const ppm = kg.map((k, i) => (k ? (sac[i] / k) * 1_000_000 : null))
  const withPpm = ppm.filter((v): v is number => v != null)
  const limit = (prev: number, pct: number) => Math.round(prev * (1 - pct / 100))
  const sacTotal = sac.reduce((a, b) => a + b, 0)
  const fcTotal = fc.reduce((a, b) => a + b, 0)
  return {
    sac, fc, kg, ppm, sacTotal, fcTotal,
    sacLimit: goals ? limit(goals.prevSac, goals.sacReductionPct) : null,
    fcLimit: goals ? limit(goals.prevFc, goals.fcReductionPct) : null,
    ppmTarget: goals ? goals.prevPpm * (1 - goals.ppmReductionPct / 100) : null,
    ppmAverage: withPpm.length ? withPpm.reduce((a, b) => a + b, 0) / withPpm.length : null,
    goals,
  }
}

export type GoalsReport = ReturnType<typeof goalsReport>
