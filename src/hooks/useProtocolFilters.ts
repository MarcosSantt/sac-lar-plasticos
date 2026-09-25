import { useMemo, useState } from 'react'
import type { Priority, Protocol, ProtocolStatus } from '../types'
import { normalize } from '../utils/format'

export interface ProtocolFilters {
  search: string
  status: ProtocolStatus | ''
  categoryId: string
  priority: Priority | ''
  responsibleId: string
  observerId: string
  period: '' | '7' | '30' | '90'
}

export const EMPTY_FILTERS: ProtocolFilters = {
  search: '', status: '', categoryId: '', priority: '', responsibleId: '', observerId: '', period: '',
}

export function useProtocolFilters(protocols: Protocol[]) {
  const [filters, setFilters] = useState<ProtocolFilters>(EMPTY_FILTERS)

  const filtered = useMemo(() => {
    const q = normalize(filters.search.trim())
    const minDate = filters.period ? Date.now() - Number(filters.period) * 86400000 : 0
    return protocols.filter((p) => {
      if (q && !normalize(`${p.protocolNumber} ${p.title} ${p.requester.name}`).includes(q)) return false
      if (filters.status && p.status !== filters.status) return false
      if (filters.categoryId && p.categoryId !== filters.categoryId) return false
      if (filters.priority && p.priority !== filters.priority) return false
      if (filters.responsibleId && p.responsibleId !== filters.responsibleId) return false
      if (filters.observerId && !p.observerIds.includes(filters.observerId)) return false
      if (minDate && new Date(p.createdAt).getTime() < minDate) return false
      return true
    })
  }, [protocols, filters])

  const set = <K extends keyof ProtocolFilters>(key: K, value: ProtocolFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }))

  const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && v !== '').length

  return { filters, set, reset: () => setFilters(EMPTY_FILTERS), filtered, activeCount }
}
