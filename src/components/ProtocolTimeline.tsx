import { useState } from 'react'
import type { Protocol } from '../types'
import { formatDate } from '../utils/format'
import { useStore } from '../store/StoreContext'
import { MessageBubble } from './MessageBubble'

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(); y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === y.toDateString()) return 'Ontem'
  return formatDate(iso)
}

export function ProtocolTimeline({ protocol }: { protocol: Protocol }) {
  const { getObserver } = useStore()
  const [initialCount] = useState(protocol.messages.length)

  return (
    <div className="space-y-5">
      {protocol.messages.map((m, i) => {
        const day = dayLabel(m.createdAt)
        const showDay = i === 0 || day !== dayLabel(protocol.messages[i - 1].createdAt)
        return (
          <div key={m.id}>
            {showDay && (
              <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />{day}<span className="h-px flex-1 bg-slate-200" />
              </div>
            )}
            <MessageBubble
              message={m}
              isFirst={i === 0}
              isNew={i >= initialCount}
              observerDepartment={m.author.role === 'observer' ? getObserver(m.author.id)?.department : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}
