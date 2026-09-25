import type { Priority } from '../types'
import { PRIORITY_META, PRIORITY_ORDER } from '../utils/protocol'

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority]
  const level = PRIORITY_ORDER.indexOf(priority) + 1
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`w-[3px] rounded-sm ${i <= level ? meta.bar : 'bg-current opacity-15'}`} style={{ height: 3 + i * 2 }} />
        ))}
      </span>
      {meta.label}
    </span>
  )
}
