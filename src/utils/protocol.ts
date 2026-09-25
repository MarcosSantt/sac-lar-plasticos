import type { Priority, Protocol, ProtocolStatus, RequestType } from '../types'
import { minutesBetween } from './format'

export const STATUS_META: Record<ProtocolStatus, { label: string; dot: string; badge: string; emoji: string; pulse?: boolean }> = {
  novo: { label: 'Novo', emoji: '🔵', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 ring-blue-200' },
  em_atendimento: { label: 'Em atendimento', emoji: '🟢', dot: 'bg-brand-accent', badge: 'bg-brand-50 text-brand-700 ring-brand-300', pulse: true },
  aguardando_cliente: { label: 'Aguardando cliente', emoji: '🟡', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-800 ring-amber-500/40' },
  aguardando_terceiro: { label: 'Aguardando terceiro', emoji: '🟠', dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 ring-orange-500/35' },
  resolvido: { label: 'Resolvido', emoji: '✅', dot: 'bg-white', badge: 'bg-brand-700 text-white ring-brand-700' },
  fechado: { label: 'Fechado', emoji: '⚫', dot: 'bg-slate-500', badge: 'bg-slate-100 text-slate-600 ring-slate-300' },
}

/** Cor da barra/ponto do status em gráficos (Resolvido usa o verde da marca, não o branco do badge). */
export const STATUS_BAR: Record<ProtocolStatus, string> = {
  novo: 'bg-blue-500',
  em_atendimento: 'bg-brand-500',
  aguardando_cliente: 'bg-amber-500',
  aguardando_terceiro: 'bg-orange-500',
  resolvido: 'bg-brand-700',
  fechado: 'bg-slate-400',
}

export const STATUS_ORDER: ProtocolStatus[] = [
  'novo', 'em_atendimento', 'aguardando_cliente', 'aguardando_terceiro', 'resolvido', 'fechado',
]

export const PRIORITY_META: Record<Priority, { label: string; badge: string; bar: string }> = {
  baixa: { label: 'Baixa', badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
  media: { label: 'Média', badge: 'bg-blue-50 text-blue-700', bar: 'bg-blue-500' },
  alta: { label: 'Alta', badge: 'bg-amber-50 text-amber-800', bar: 'bg-amber-500' },
  urgente: { label: 'Urgente', badge: 'bg-red-50 text-red-700', bar: 'bg-red-500' },
}

export const PRIORITY_ORDER: Priority[] = ['baixa', 'media', 'alta', 'urgente']

export const REQUEST_TYPES: RequestType[] = ['Solicitação', 'Reclamação', 'Dúvida', 'Sugestão', 'Elogio']

export const OPEN_STATUSES: ProtocolStatus[] = ['novo', 'em_atendimento', 'aguardando_cliente', 'aguardando_terceiro']

export const isClosed = (s: ProtocolStatus) => s === 'resolvido' || s === 'fechado'

export interface ProtocolMetrics {
  firstResponse: number | null
  averageResponse: number | null
  totalTime: number
  agentReplies: number
}

/**
 * Métricas de SLA:
 * - Primeira resposta: abertura → primeira mensagem da equipe SAC.
 * - Tempo médio de resposta: média dos tempos de resposta das mensagens do SAC
 *   que respondem a uma mensagem de solicitante/observador.
 * - Tempo total: abertura → encerramento (ou última atualização se ainda aberto).
 */
export function computeMetrics(p: Protocol): ProtocolMetrics {
  const firstAgent = p.messages.find((m) => m.author.role === 'agent')
  const firstResponse = firstAgent ? minutesBetween(p.createdAt, firstAgent.createdAt) : null

  const replies: number[] = []
  p.messages.forEach((m, i) => {
    if (i === 0 || m.author.role !== 'agent' || m.responseTime == null) return
    const prev = p.messages[i - 1]
    if (prev.author.role !== 'agent') replies.push(m.responseTime)
  })
  const averageResponse = replies.length ? replies.reduce((a, b) => a + b, 0) / replies.length : null
  const end = p.closedAt ?? p.updatedAt
  return { firstResponse, averageResponse, totalTime: minutesBetween(p.createdAt, end), agentReplies: replies.length }
}

export function average(values: (number | null)[]) {
  const v = values.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
