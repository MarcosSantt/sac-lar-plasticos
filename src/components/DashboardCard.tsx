import type { ReactNode } from 'react'

interface DashboardCardProps {
  label: string
  value: ReactNode
  icon: ReactNode
  tone: 'blue' | 'accent' | 'amber' | 'orange' | 'green' | 'slate'
  hint?: string
  onClick?: () => void
}

/** Ponto com a cor semântica do status; o restante do card segue a marca. */
const TONES = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  accent: 'bg-brand-accent',
  green: 'bg-brand-700',
  slate: 'bg-slate-400',
}

export function DashboardCard({ label, value, icon, tone, hint, onClick }: DashboardCardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`card group relative flex w-full flex-col overflow-hidden p-4 text-left transition-all duration-200 ${onClick ? 'hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md hover:shadow-brand-900/5' : ''}`}
    >
      <span className="absolute inset-x-0 top-0 h-[3px] bg-brand-600 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
          <span className={`h-2 w-2 shrink-0 rounded-full ${TONES[tone]}`} />
          {label}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
      </div>
      <div className="mt-2 text-[28px] leading-tight font-semibold tracking-tight text-brand-700">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Tag>
  )
}
