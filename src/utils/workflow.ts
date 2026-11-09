import type { Protocol } from '../types'
import { minutesBetween } from './format'
import { OPEN_STATUSES } from './protocol'

/** Com quem está a tratativa neste momento. */
export type WorkflowStage = 'sac_owes' | 'sac_working' | 'requester' | 'third'

export const STAGE_ORDER: WorkflowStage[] = ['sac_owes', 'sac_working', 'requester', 'third']

export const STAGE_META: Record<WorkflowStage, { title: string; description: string; dot: string }> = {
  sac_owes: { title: 'SAC deve resposta', description: 'Alguém escreveu e a equipe ainda não respondeu', dot: 'bg-red-500' },
  sac_working: { title: 'Em tratativa no SAC', description: 'A última palavra foi do SAC, que segue resolvendo', dot: 'bg-brand-500' },
  requester: { title: 'Aguardando solicitante', description: 'O SAC pediu um retorno de quem abriu', dot: 'bg-amber-500' },
  third: { title: 'Aguardando terceiro', description: 'Depende de outra área ou de um parceiro externo', dot: 'bg-orange-500' },
}

export interface WorkflowItem {
  protocol: Protocol
  stage: WorkflowStage
  /** Desde quando a tratativa está parada nesta etapa. */
  since: string
  waitingMin: number
  /** Resposta do SAC pendente há mais tempo que a meta configurada. */
  late: boolean
}

/**
 * Onde está cada protocolo em aberto:
 * - "Aguardando cliente" e "Aguardando terceiro" seguem o status definido pela equipe;
 * - nos demais, a bola está com o SAC: se a última mensagem não é da equipe, há uma resposta pendente.
 */
export function workflowOf(p: Protocol, now: number, targetMin: number): WorkflowItem | null {
  if (!OPEN_STATUSES.includes(p.status)) return null
  const last = p.messages[p.messages.length - 1]
  const lastAt = last?.createdAt ?? p.createdAt

  let stage: WorkflowStage
  let since = lastAt
  if (p.status === 'aguardando_cliente' || p.status === 'aguardando_terceiro') {
    stage = p.status === 'aguardando_cliente' ? 'requester' : 'third'
    // Conta a partir da mudança de status que colocou o protocolo em espera.
    since = [...p.history].reverse().find((h) => h.kind === 'status')?.createdAt ?? p.updatedAt
  } else {
    stage = last?.author.role === 'agent' ? 'sac_working' : 'sac_owes'
  }

  const waitingMin = Math.max(0, minutesBetween(since, new Date(now).toISOString()))
  return { protocol: p, stage, since, waitingMin, late: stage === 'sac_owes' && waitingMin > targetMin }
}
