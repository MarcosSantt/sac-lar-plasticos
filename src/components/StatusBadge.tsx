import type { ProtocolStatus } from '../types'
import { STATUS_META } from '../utils/protocol'

export function StatusBadge({ status, size = 'sm' }: { status: ProtocolStatus; size?: 'sm' | 'md' }) {
  const meta = STATUS_META[status]
  return (
    <span
      key={status}
      className={`inline-flex animate-fade-in items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${meta.badge} ${size === 'md' ? 'px-3 py-1 text-[13px]' : 'px-2.5 py-0.5 text-xs'}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {meta.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${meta.dot}`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      </span>
      {meta.label}
    </span>
  )
}
