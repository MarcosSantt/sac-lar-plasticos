import type { Author, Protocol } from '../types'
import { useStore } from '../store/StoreContext'

export interface Participant { id: string; name: string; email: string; role: 'Solicitante' | 'Atendente SAC' | 'Observador'; detail?: string; messages: number }

export function useParticipants(p: Protocol): Participant[] {
  const { getUser, getObserver } = useStore()
  const count = (id: string) => p.messages.filter((m) => m.author.id === id).length
  const list: Participant[] = [{ id: 'requester', name: p.requester.name, email: p.requester.email, role: 'Solicitante', messages: count('requester') }]
  const r = getUser(p.responsibleId)
  if (r) list.push({ id: r.id, name: r.name, email: r.email, role: 'Atendente SAC', detail: 'Responsável', messages: count(r.id) })
  p.observerIds.forEach((id) => {
    const o = getObserver(id)
    if (o) list.push({ id: o.id, name: o.name, email: o.email, role: 'Observador', detail: o.department, messages: count(o.id) })
  })
  // Atendentes que participaram sem serem os responsáveis atuais.
  p.messages.forEach((m) => {
    if (m.author.role === 'agent' && !list.some((x) => x.id === m.author.id)) {
      const u = getUser(m.author.id)
      list.push({ id: m.author.id, name: m.author.name, email: u?.email ?? '', role: 'Atendente SAC', messages: count(m.author.id) })
    }
  })
  return list
}

/** Pessoas que podem escrever no protocolo: solicitante, responsável, observadores e a equipe SAC. */
export function useProtocolAuthors(p: Protocol): Author[] {
  const { users, observers, currentUser } = useStore()
  const list: Author[] = [{ id: 'requester', name: p.requester.name, role: 'requester' }]
  const responsible = users.find((u) => u.id === p.responsibleId)
  if (responsible) list.push({ id: responsible.id, name: responsible.name, role: 'agent' })
  p.observerIds.forEach((id) => {
    const o = observers.find((x) => x.id === id)
    if (o) list.push({ id: o.id, name: o.name, role: 'observer' })
  })
  if (currentUser.role === 'agent' && !list.some((a) => a.id === currentUser.id)) {
    list.push({ id: currentUser.id, name: currentUser.name, role: 'agent' })
  }
  return list
}
