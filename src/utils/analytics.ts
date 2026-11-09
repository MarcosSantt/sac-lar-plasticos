import type { Category, Priority, Protocol, RequestType, User } from '../types'
import { average, computeMetrics, isClosed, OPEN_STATUSES, PRIORITY_META, PRIORITY_ORDER, REQUEST_TYPES } from './protocol'
import { minutesBetween } from './format'

export interface MonthRef { year: number; month: number } // month: 0–11

export const monthOf = (d: Date): MonthRef => ({ year: d.getFullYear(), month: d.getMonth() })
export const shiftMonth = (m: MonthRef, by: number): MonthRef => monthOf(new Date(m.year, m.month + by, 1))
export const sameMonth = (a: MonthRef, b: MonthRef) => a.year === b.year && a.month === b.month
const inMonth = (iso: string | null, m: MonthRef) => !!iso && sameMonth(monthOf(new Date(iso)), m)

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const monthLabel = (m: MonthRef) => `${MONTHS[m.month]} de ${m.year}`
export const monthShort = (m: MonthRef) => `${MONTHS[m.month].slice(0, 3)}/${String(m.year).slice(2)}`

export interface Ranked { key: string; label: string; value: number }

function rank<T extends string>(items: Protocol[], key: (p: Protocol) => T, label: (k: T) => string): Ranked[] {
  const counts = new Map<T, number>()
  items.forEach((p) => counts.set(key(p), (counts.get(key(p)) ?? 0) + 1))
  return [...counts].map(([k, value]) => ({ key: k, label: label(k), value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

export interface AgentRow {
  id: string; name: string; assigned: number; resolved: number; open: number
  firstResponse: number | null; withinTarget: number | null
}

/** Indicadores do SAC para um mês (protocolos abertos nele, salvo indicação em contrário). */
export function monthReport(protocols: Protocol[], month: MonthRef, opts: { categories: Category[]; agents: User[]; targetMin: number }) {
  const opened = protocols.filter((p) => inMonth(p.createdAt, month))
  const openedBefore = protocols.filter((p) => inMonth(p.createdAt, shiftMonth(month, -1))).length
  const closed = protocols.filter((p) => isClosed(p.status) && inMonth(p.closedAt, month))

  const firsts = opened.map((p) => computeMetrics(p).firstResponse)
  const answered = firsts.filter((f): f is number => f != null)
  const withinTarget = answered.filter((f) => f <= opts.targetMin).length
  const sla = (list: Protocol[]) => {
    const f = list.map((p) => computeMetrics(p).firstResponse).filter((x): x is number => x != null)
    return f.length ? f.filter((x) => x <= opts.targetMin).length / f.length : null
  }

  const categoryName = (id: string) => opts.categories.find((c) => c.id === id)?.name ?? 'Sem categoria'
  const days = new Date(month.year, month.month + 1, 0).getDate()
  const daily = Array.from({ length: days }, () => 0)
  opened.forEach((p) => { daily[new Date(p.createdAt).getDate() - 1]++ })

  const agents: AgentRow[] = opts.agents.map((a) => {
    const mine = opened.filter((p) => p.responsibleId === a.id)
    return {
      id: a.id,
      name: a.name,
      assigned: mine.length,
      resolved: closed.filter((p) => p.responsibleId === a.id).length,
      open: protocols.filter((p) => p.responsibleId === a.id && OPEN_STATUSES.includes(p.status)).length,
      firstResponse: average(mine.map((p) => computeMetrics(p).firstResponse)),
      withinTarget: sla(mine),
    }
  }).filter((a) => a.assigned || a.resolved || a.open).sort((a, b) => b.assigned - a.assigned || a.name.localeCompare(b.name))

  return {
    opened: opened.length,
    openedBefore,
    resolved: closed.length,
    /** Dos protocolos abertos no mês, quantos já foram encerrados. */
    resolutionRate: opened.length ? opened.filter((p) => isClosed(p.status)).length / opened.length : null,
    firstResponse: average(firsts),
    withinTarget: answered.length ? withinTarget / answered.length : null,
    resolutionTime: average(closed.map((p) => minutesBetween(p.createdAt, p.closedAt!))),
    backlog: protocols.filter((p) => OPEN_STATUSES.includes(p.status)).length,
    byCategory: rank(opened, (p) => p.categoryId, categoryName),
    byType: REQUEST_TYPES.map((t: RequestType) => ({ key: t, label: t, value: opened.filter((p) => p.type === t).length })).sort((a, b) => b.value - a.value),
    byPriority: PRIORITY_ORDER.map((pr: Priority) => ({ key: pr, label: PRIORITY_META[pr].label, value: opened.filter((p) => p.priority === pr).length })).reverse(),
    daily,
    agents,
  }
}

/** Abertos x encerrados nos últimos meses, terminando no mês informado. */
export function monthlyTrend(protocols: Protocol[], until: MonthRef, months = 6) {
  return Array.from({ length: months }, (_, i) => shiftMonth(until, i - months + 1)).map((m) => ({
    month: m,
    label: monthShort(m),
    opened: protocols.filter((p) => inMonth(p.createdAt, m)).length,
    resolved: protocols.filter((p) => isClosed(p.status) && inMonth(p.closedAt, m)).length,
  }))
}
