import type { PersonRole, Protocol } from '../types'
import { useStore } from '../store/StoreContext'

export interface Participant { id: string; name: string; email: string; role: 'Solicitante' | 'Atendente SAC' | 'Observador' | 'Coordenação' | 'Pós-vendas'; detail?: string; messages: number }

const REPLIED_AS: Partial<Record<PersonRole, Participant['role']>> = { agent: 'Atendente SAC', coordinator: 'Coordenação', post_sales: 'Pós-vendas' }

export function useParticipants(p: Protocol): Participant[] {
  const { getUser, getObserver } = useStore()
  const count = (id: string) => p.messages.filter((m) => m.author.id === id).length
  const list: Participant[] = [{ id: p.requesterId, name: p.requester.name, email: p.requester.email, role: 'Solicitante', messages: count(p.requesterId) }]
  const r = getUser(p.responsibleId)
  if (r && r.id !== p.requesterId) list.push({ id: r.id, name: r.name, email: r.email, role: 'Atendente SAC', detail: 'Responsável', messages: count(r.id) })
  p.observerIds.forEach((id) => {
    const o = getObserver(id)
    if (o) list.push({ id: o.id, name: o.name, email: o.email, role: 'Observador', detail: o.department, messages: count(o.id) })
  })
  // Atendentes, coordenadores e pós-vendas que participaram da conversa.
  p.messages.forEach((m) => {
    const role = REPLIED_AS[m.author.role]
    if (role && !list.some((x) => x.id === m.author.id)) {
      const u = getUser(m.author.id)
      list.push({ id: m.author.id, name: m.author.name, email: u?.email ?? '', role, messages: count(m.author.id) })
    }
  })
  return list
}
