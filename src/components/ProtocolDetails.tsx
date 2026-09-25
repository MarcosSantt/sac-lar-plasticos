import type { ReactNode } from 'react'
import { FileText, Paperclip, Timer, Users } from 'lucide-react'
import type { Protocol } from '../types'
import { useStore } from '../store/StoreContext'
import { formatDateTime, formatDuration } from '../utils/format'
import { computeMetrics, isClosed } from '../utils/protocol'
import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'
import { ParticipantList } from './ParticipantList'
import { useParticipants } from '../hooks/useParticipants'
import { AttachmentList } from './AttachmentList'
import { Avatar } from './Avatar'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="shrink-0 text-[12px] text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] font-medium text-slate-800">{children}</dd>
    </div>
  )
}

export function SectionTitle({ icon, children, count }: { icon: ReactNode; children: ReactNode; count?: number }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
      <span className="text-brand-600">{icon}</span>{children}{count != null && <span className="rounded-full bg-brand-50 px-1.5 text-[10px] text-brand-700">{count}</span>}
    </h3>
  )
}

function Meter({ value, target }: { value: number | null; target: number }) {
  if (value == null) return <div className="h-1.5 rounded-full bg-slate-100" />
  const pct = Math.min(100, (value / target) * 100)
  const ok = value <= target
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" title={`Meta: ${formatDuration(target)}`}>
      <div className={`h-full rounded-full transition-all duration-500 ${ok ? 'bg-brand-500' : 'bg-amber-500'}`} style={{ width: `${Math.max(pct, 4)}%` }} />
    </div>
  )
}

/** Indicadores de tempo de atendimento (SLA). */
export function ProtocolMetrics({ protocol }: { protocol: Protocol }) {
  const { settings } = useStore()
  const m = computeMetrics(protocol)
  const target = settings.firstResponseTargetMin
  const firstOk = m.firstResponse != null && m.firstResponse <= target
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between rounded-lg border border-brand-100 bg-brand-50 px-3.5 py-3">
        <div>
          <p className="text-[10px] font-semibold tracking-wider text-brand-700 uppercase">Tempo total</p>
          <p key={m.totalTime} className="animate-fade-in text-2xl leading-tight font-semibold text-brand-800">{formatDuration(m.totalTime)}</p>
        </div>
        <span className="text-[11px] text-slate-500">{isClosed(protocol.status) ? 'até o encerramento' : 'até a última atualização'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Primeira resposta</p>
          <p key={String(m.firstResponse)} className={`mt-0.5 mb-2 animate-fade-in text-lg font-semibold ${m.firstResponse == null ? 'text-slate-400' : firstOk ? 'text-brand-700' : 'text-amber-700'}`}>
            {m.firstResponse == null ? 'Pendente' : formatDuration(m.firstResponse)}
          </p>
          <Meter value={m.firstResponse} target={target} />
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2.5">
          <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Tempo médio</p>
          <p key={String(m.averageResponse)} className="mt-0.5 mb-2 animate-fade-in text-lg font-semibold text-slate-800">{formatDuration(m.averageResponse)}</p>
          <Meter value={m.averageResponse} target={target} />
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <span className={`h-1.5 w-1.5 rounded-full ${m.firstResponse == null ? 'bg-slate-300' : firstOk ? 'bg-brand-500' : 'bg-amber-500'}`} />
        Meta de 1ª resposta: {formatDuration(target)}{m.firstResponse != null && (firstOk ? ' · dentro da meta' : ' · acima da meta')}
      </p>
    </div>
  )
}

interface ProtocolDetailsProps {
  protocol: Protocol
  onAddObserver: () => void
  onRemoveObserver: (id: string) => void
}

export function ProtocolDetails({ protocol: p, onAddObserver, onRemoveObserver }: ProtocolDetailsProps) {
  const { getCategoryName, getUser } = useStore()
  const responsible = getUser(p.responsibleId)
  const participants = useParticipants(p)
  return (
    <div className="divide-y divide-slate-200">
      <section className="p-5">
        <SectionTitle icon={<FileText className="h-3.5 w-3.5" />}>Detalhes do protocolo</SectionTitle>
        <p className="text-[11px] font-medium text-slate-500">Protocolo</p>
        <p className="font-mono text-lg font-bold text-brand-800">{p.protocolNumber}</p>
        <dl className="mt-2 divide-y divide-slate-100">
          <Row label="Status"><StatusBadge status={p.status} /></Row>
          <Row label="Tipo">{p.type}</Row>
          <Row label="Categoria">{getCategoryName(p.categoryId)}</Row>
          <Row label="Prioridade"><PriorityBadge priority={p.priority} /></Row>
          <Row label="Solicitante">{p.requester.name}</Row>
          <Row label="Responsável">
            {responsible ? <span className="inline-flex items-center gap-1.5"><Avatar name={responsible.name} size="xs" />{responsible.name}</span> : <span className="text-slate-400">Não atribuído</span>}
          </Row>
          <Row label="Abertura">{formatDateTime(p.createdAt)}</Row>
          <Row label="Última atualização">{formatDateTime(p.updatedAt)}</Row>
          {p.closedAt && <Row label="Encerramento">{formatDateTime(p.closedAt)}</Row>}
        </dl>
      </section>

      <section className="p-5">
        <SectionTitle icon={<Timer className="h-3.5 w-3.5" />}>Tempo de atendimento</SectionTitle>
        <ProtocolMetrics protocol={p} />
      </section>

      <section className="p-5">
        <SectionTitle icon={<Users className="h-3.5 w-3.5" />} count={participants.length}>Participantes</SectionTitle>
        <ParticipantList protocol={p} onAdd={onAddObserver} onRemoveObserver={onRemoveObserver} />
      </section>

      <section className="p-5">
        <SectionTitle icon={<Paperclip className="h-3.5 w-3.5" />} count={p.attachments.length}>Anexos</SectionTitle>
        {p.attachments.length ? <AttachmentList attachments={p.attachments} variant="compact" /> : <p className="text-[13px] text-slate-400">Nenhum anexo até o momento.</p>}
      </section>
    </div>
  )
}
