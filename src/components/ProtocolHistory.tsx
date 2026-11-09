import { ArrowRightLeft, ClipboardList, Eye, EyeOff, FilePlus2, MessageSquare, Package, Paperclip, UserCheck } from 'lucide-react'
import type { HistoryKind, Protocol } from '../types'
import { formatShortDateTime } from '../utils/format'

const ICONS: Record<HistoryKind, { icon: typeof Eye; cls: string }> = {
  created: { icon: FilePlus2, cls: 'bg-blue-50 text-blue-600' },
  assigned: { icon: UserCheck, cls: 'bg-brand-50 text-brand-600' },
  observer_added: { icon: Eye, cls: 'bg-violet-50 text-violet-600' },
  observer_removed: { icon: EyeOff, cls: 'bg-slate-100 text-slate-500' },
  message: { icon: MessageSquare, cls: 'bg-slate-100 text-slate-600' },
  status: { icon: ArrowRightLeft, cls: 'bg-amber-50 text-amber-600' },
  attachment: { icon: Paperclip, cls: 'bg-brand-50 text-brand-600' },
  items: { icon: Package, cls: 'bg-blue-50 text-blue-600' },
  details: { icon: ClipboardList, cls: 'bg-slate-100 text-slate-600' },
}

export function ProtocolHistory({ protocol }: { protocol: Protocol }) {
  const events = [...protocol.history].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <ol className="relative">
      {events.map((e, i) => {
        const { icon: Icon, cls } = ICONS[e.kind]
        return (
          <li key={e.id} className="relative flex animate-fade-in gap-4 pb-5">
            {i < events.length - 1 && <span className="absolute top-8 bottom-0 left-4 w-px bg-slate-200" />}
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${cls}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-[13px] font-medium text-slate-800">{e.description}</p>
              <p className="text-xs text-slate-500"><span className="font-mono">{formatShortDateTime(e.createdAt)}</span> · por {e.actor}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
