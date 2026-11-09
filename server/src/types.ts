export const PROTOCOL_STATUSES = ['novo', 'em_atendimento', 'aguardando_cliente', 'aguardando_terceiro', 'resolvido', 'fechado'] as const
export type ProtocolStatus = (typeof PROTOCOL_STATUSES)[number]

export const PRIORITIES = ['baixa', 'media', 'alta', 'urgente'] as const
export const REQUEST_TYPES = ['Reclamação', 'Solicitação', 'Dúvida', 'Sugestão', 'Elogio'] as const
/** Perfil da conta. */
export const ACCOUNT_ROLES = ['seller', 'post_sales', 'coordinator', 'agent', 'observer'] as const
export type AccountRole = (typeof ACCOUNT_ROLES)[number]

/** Papel de uma pessoa dentro de um protocolo (quem abriu é sempre o solicitante). */
export type Role = 'requester' | 'agent' | 'observer' | 'coordinator' | 'post_sales'

/** Perfis que podem abrir protocolos. */
export const OPENER_ROLES: AccountRole[] = ['seller', 'post_sales']

export const OPEN_STATUSES: ProtocolStatus[] = ['novo', 'em_atendimento', 'aguardando_cliente', 'aguardando_terceiro']

export const STATUS_LABEL: Record<ProtocolStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  aguardando_cliente: 'Aguardando cliente',
  aguardando_terceiro: 'Aguardando terceiro',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
}

export const ROLE_LABEL: Record<Role, string> = {
  requester: 'Solicitante', agent: 'Atendente', observer: 'Observador', coordinator: 'Coordenador', post_sales: 'Pós-vendas',
}

/** Usuário autenticado na requisição. */
export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string
  department: string
  title: string
  role: AccountRole
  isAdmin: boolean
  mustChangePassword: boolean
  /** Equipes às quais a conta está vinculada. */
  teamIds: string[]
}
