import type { AccountRole, Persona } from '../types'

export const ACCOUNT_ROLE_LABEL: Record<AccountRole, string> = {
  seller: 'Vendedor',
  post_sales: 'Pós-vendas',
  coordinator: 'Coordenador',
  agent: 'Equipe SAC',
  observer: 'Observador',
}

// Regras de tela; o servidor valida cada operação de qualquer forma.

/** Somente vendedores e pós-vendas abrem protocolos. */
export const canOpenProtocol = (u: Persona) => u.role === 'seller' || u.role === 'post_sales'

/** Equipe SAC: vê todos os protocolos e altera status, responsável e prioridade. */
export const isSacTeam = (u: Persona) => u.role === 'agent'

/** Quem acompanha uma carteira (ou todas) tem a lista geral de protocolos e o dashboard, já filtrados pelo servidor. */
export const canSeePortfolio = (u: Persona) => u.role === 'agent' || u.role === 'coordinator' || u.role === 'post_sales'
