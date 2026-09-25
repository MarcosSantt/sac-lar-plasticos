import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import type { Protocol } from '../types'
import { useStore } from '../store/StoreContext'
import { formatDateTime, formatRelative } from '../utils/format'
import { Avatar } from './Avatar'
import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'

export type ProtocolColumn = 'protocol' | 'title' | 'category' | 'priority' | 'status' | 'responsible' | 'requester' | 'createdAt' | 'updatedAt' | 'observers'

const HEADERS: Record<ProtocolColumn, string> = {
  protocol: 'Protocolo', title: 'Assunto', category: 'Categoria', priority: 'Prioridade', status: 'Status',
  responsible: 'Responsável', requester: 'Solicitante', createdAt: 'Abertura', updatedAt: 'Última atualização', observers: 'Observadores',
}

export function ProtocolTable({ protocols, columns }: { protocols: Protocol[]; columns: ProtocolColumn[] }) {
  const { getCategoryName, getUser, getObserver } = useStore()
  const navigate = useNavigate()
  const open = (p: Protocol) => navigate(`/protocolos/${p.protocolNumber}`)

  const cell = (p: Protocol, c: ProtocolColumn) => {
    switch (c) {
      case 'protocol':
        return <span className="font-mono text-[13px] font-semibold whitespace-nowrap text-brand-700">{p.protocolNumber}</span>
      case 'title':
        return (
          <div className="max-w-[340px] min-w-[200px]">
            <p className="truncate font-medium text-slate-900">{p.title}</p>
            <p className="truncate text-xs text-slate-500">{p.requester.name} · {p.type}</p>
          </div>
        )
      case 'category':
        return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{getCategoryName(p.categoryId)}</span>
      case 'priority':
        return <PriorityBadge priority={p.priority} />
      case 'status':
        return <StatusBadge status={p.status} />
      case 'responsible': {
        const u = getUser(p.responsibleId)
        return u ? (
          <span className="flex items-center gap-2 whitespace-nowrap"><Avatar name={u.name} size="xs" />{u.name}</span>
        ) : <span className="text-xs text-slate-400">Não atribuído</span>
      }
      case 'requester':
        return <span className="whitespace-nowrap">{p.requester.name}</span>
      case 'observers':
        return p.observerIds.length ? (
          <span className="flex -space-x-1.5">
            {p.observerIds.slice(0, 3).map((id) => { const o = getObserver(id); return o && <Avatar key={id} name={o.name} size="xs" ring /> })}
            {p.observerIds.length > 3 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ring-2 ring-white">+{p.observerIds.length - 3}</span>}
          </span>
        ) : <span className="text-xs text-slate-400">—</span>
      case 'createdAt':
        return <span className="whitespace-nowrap text-slate-600">{formatDateTime(p.createdAt)}</span>
      case 'updatedAt':
        return (
          <span className="whitespace-nowrap">
            <span className="block text-slate-700">{formatRelative(p.updatedAt)}</span>
            <span className="block text-xs text-slate-400">{formatDateTime(p.updatedAt)}</span>
          </span>
        )
    }
  }

  return (
    <>
      {/* Tabela: tablet e desktop */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50/70">
            <tr>
              {columns.map((c) => <th key={c} className="th">{HEADERS[c]}</th>)}
              <th className="th w-10"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {protocols.map((p) => (
              <tr key={p.id} onClick={() => open(p)} className="group cursor-pointer transition-colors hover:bg-brand-50/40">
                {columns.map((c) => <td key={c} className="td">{cell(p, c)}</td>)}
                <td className="td text-right">
                  <Eye className="ml-auto h-4 w-4 text-slate-300 transition group-hover:text-brand-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartões: celular */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {protocols.map((p) => (
          <li key={p.id}>
            <button onClick={() => open(p)} className="w-full px-4 py-3.5 text-left active:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-brand-700">{p.protocolNumber}</span>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-1 font-medium text-slate-900">{p.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{getCategoryName(p.categoryId)}</span>·<PriorityBadge priority={p.priority} />·<span>{formatRelative(p.updatedAt)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
