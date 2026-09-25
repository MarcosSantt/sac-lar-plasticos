import { Link } from 'react-router-dom'
import { Clock, MessageSquare, Paperclip } from 'lucide-react'
import type { Protocol } from '../types'
import { useStore } from '../store/StoreContext'
import { formatRelative } from '../utils/format'
import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'

export function ProtocolCard({ protocol: p }: { protocol: Protocol }) {
  const { getCategoryName } = useStore()
  return (
    <Link
      to={`/protocolos/${p.protocolNumber}`}
      className="block rounded-lg border border-slate-200 bg-white p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md hover:shadow-slate-900/5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-brand-700">{p.protocolNumber}</span>
        <PriorityBadge priority={p.priority} />
      </div>
      <p className="mt-1.5 line-clamp-1 text-[13px] font-medium text-slate-900">{p.title}</p>
      <p className="text-xs text-slate-500">{getCategoryName(p.categoryId)} · {p.requester.name}</p>
      <div className="mt-2.5 flex items-center justify-between">
        <StatusBadge status={p.status} />
        <span className="flex items-center gap-2.5 text-[11px] text-slate-400">
          <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{p.messages.length}</span>
          {p.attachments.length > 0 && <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{p.attachments.length}</span>}
          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{formatRelative(p.updatedAt)}</span>
        </span>
      </div>
    </Link>
  )
}
