import type { Ranked } from '../../utils/sacDashboard'

interface RankListProps {
  items: Ranked[]
  format?: (v: number) => string
  /** Mostra a participação no total ao lado do valor. */
  showShare?: boolean
  empty?: string
}

/** Top N em barras horizontais de uma única série: rótulo, barra e valor na ponta. */
export function RankList({ items, format = (v) => v.toLocaleString('pt-BR'), showShare = true, empty = 'Sem dados no período.' }: RankListProps) {
  if (!items.length) return <p className="py-6 text-center text-[13px] text-slate-500">{empty}</p>
  const max = Math.max(...items.map((i) => i.value))
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const share = `${Math.round(item.share * 1000) / 10}%`.replace('.', ',')
        return (
          <li key={item.key} title={`${item.label}: ${format(item.value)}${showShare ? ` (${share} do total)` : ''}`} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate text-slate-700 group-hover:text-slate-900">{item.label}</span>
              <span className="shrink-0 tabular-nums text-slate-900"><b className="font-semibold">{format(item.value)}</b>{showShare && <span className="ml-1.5 text-xs text-slate-500">{share}</span>}</span>
            </div>
            <div className="h-2.5 rounded-r bg-slate-100">
              <div className="h-full rounded-r bg-brand-600 transition-all duration-500 group-hover:bg-brand-700" style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
