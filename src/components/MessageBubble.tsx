import { Clock, Timer } from 'lucide-react'
import type { Message } from '../types'
import { formatDuration, formatFriendly } from '../utils/format'
import { Avatar } from './Avatar'
import { AttachmentList } from './AttachmentList'

const ROLE = {
  requester: { label: 'Solicitante', badge: 'bg-slate-100 text-slate-600', bubble: 'bg-brand-50 border-brand-100' },
  agent: { label: 'SAC Lar Plásticos', badge: 'bg-brand-600 text-white', bubble: 'bg-white border-slate-200' },
  observer: { label: 'Observador', badge: 'bg-violet-50 text-violet-700', bubble: 'bg-slate-50 border-slate-200' },
}

interface MessageBubbleProps {
  message: Message
  isFirst: boolean
  isNew?: boolean
  observerDepartment?: string
}

export function MessageBubble({ message: m, isFirst, isNew, observerDepartment }: MessageBubbleProps) {
  const role = ROLE[m.author.role]
  const right = m.author.role === 'agent'
  const slow = m.responseTime != null && m.responseTime > 60

  return (
    <div className={`flex gap-3 ${right ? 'flex-row-reverse' : ''} ${isNew ? 'animate-slide-up' : ''}`}>
      <Avatar name={m.author.name} />
      <div className={`flex max-w-[85%] min-w-0 flex-col sm:max-w-[75%] ${right ? 'items-end' : 'items-start'}`}>
        <div className={`mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${right ? 'justify-end' : ''}`}>
          <span className="text-[13px] font-semibold text-slate-900">{m.author.name}</span>
          <span className={`rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${role.badge}`}>
            {role.label}{m.author.role === 'observer' && observerDepartment ? ` · ${observerDepartment}` : ''}
          </span>
          <span className="text-xs text-slate-400">{formatFriendly(m.createdAt)}</span>
        </div>

        <div className={`rounded-2xl border px-4 py-3 shadow-[0_1px_2px_var(--shadow-color)] ${role.bubble} ${right ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
          {m.content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{m.content}</p>}
          {m.attachments.length > 0 && (
            <div className={m.content ? 'mt-3' : ''}>
              <AttachmentList attachments={m.attachments} variant="chips" />
            </div>
          )}
        </div>

        {isFirst ? (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Clock className="h-3 w-3" /> Abertura do protocolo
          </span>
        ) : m.responseTime != null && (
          m.author.role === 'agent' ? (
            <span
              title="Tempo entre a mensagem anterior e esta resposta"
              className={`mt-1.5 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
                slow ? 'border-amber-500/40 bg-amber-50 text-amber-800' : 'border-brand-200 bg-white text-brand-700'
              }`}
            >
              <Timer className="h-3.5 w-3.5" />
              Tempo de resposta: <b className="font-semibold">{formatDuration(m.responseTime)}</b>
            </span>
          ) : (
            <span title="Tempo desde a mensagem anterior" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <Timer className="h-3 w-3" /> Respondido após {formatDuration(m.responseTime)}
            </span>
          )
        )}
      </div>
    </div>
  )
}
