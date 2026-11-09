import { useMemo } from 'react'
import { useStore } from '../store/StoreContext'
import type { Persona, Protocol } from '../types'

/** Protocolos em que a pessoa participa: como solicitante, responsável ou observador. */
export function isParticipant(p: Protocol, persona: Persona) {
  return p.requesterId === persona.id || p.responsibleId === persona.id || p.observerIds.includes(persona.id)
}

export function useMyProtocols() {
  const { protocols, currentUser } = useStore()
  return useMemo(
    () => protocols.filter((p) => isParticipant(p, currentUser)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [protocols, currentUser],
  )
}
