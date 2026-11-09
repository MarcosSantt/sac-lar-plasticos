import { Mail, UserPlus, X } from 'lucide-react'
import type { Protocol } from '../types'
import { useParticipants } from '../hooks/useParticipants'
import { Avatar } from './Avatar'

const ROLE_BADGE = {
  Solicitante: 'bg-slate-100 text-slate-600',
  'Atendente SAC': 'bg-brand-100 text-brand-700',
  Observador: 'bg-violet-100 text-violet-700',
  Coordenação: 'bg-amber-100 text-amber-800',
  'Pós-vendas': 'bg-blue-100 text-blue-700',
}

interface ParticipantListProps {
  protocol: Protocol
  onAdd?: () => void
  onRemoveObserver?: (id: string) => void
  detailed?: boolean
}

export function ParticipantList({ protocol, onAdd, onRemoveObserver, detailed = false }: ParticipantListProps) {
  const participants = useParticipants(protocol)
  return (
    <div>
      <ul className={detailed ? 'divide-y divide-slate-100' : 'space-y-2.5'}>
        {participants.map((p) => (
          <li key={p.id} className={`group flex items-center gap-3 ${detailed ? 'py-3' : ''}`}>
            <Avatar name={p.name} size={detailed ? 'md' : 'sm'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-800">{p.name}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className={`rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_BADGE[p.role]}`}>{p.role}</span>
                {p.detail && <span>{p.detail}</span>}
              </p>
              {detailed && (
                <p className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>
                  <span>{p.messages} mensagem(ns)</span>
                </p>
              )}
            </div>
            {onRemoveObserver && p.role === 'Observador' && (
              <button onClick={() => onRemoveObserver(p.id)} className="rounded-md p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100" title={`Remover ${p.name}`} aria-label={`Remover ${p.name}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {onAdd && (
        <button onClick={onAdd} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-medium text-brand-600 transition hover:border-brand-400 hover:bg-brand-50/50">
          <UserPlus className="h-4 w-4" /> Adicionar observador
        </button>
      )}
    </div>
  )
}
