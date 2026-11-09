export interface BarItem { key: string; label: string; value: number }

interface BarListProps {
  items: BarItem[]
  /** Destaca a primeira barra (o maior valor) e deixa as demais em cinza. */
  emphasizeFirst?: boolean
  /** Nome do que está sendo contado, para o texto de apoio (ex.: "protocolos"). */
  unit?: string
}

/** Barras horizontais de uma única série: valor na ponta, participação no total ao lado. */
export function BarList({ items, emphasizeFirst = false, unit = 'protocolos' }: BarListProps) {
  const max = Math.max(1, ...items.map((i) => i.value))
  const total = items.reduce((sum, i) => sum + i.value, 0)
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => {
        const share = total ? Math.round((item.value / total) * 100) : 0
        const strong = !emphasizeFirst || (index === 0 && item.value > 0)
        return (
          <li key={item.key} title={`${item.label}: ${item.value} ${unit} (${share}% do total)`} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 text-[13px]">
            <span className={`truncate ${emphasizeFirst && index === 0 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{item.label}</span>
            <span className="flex h-4 items-center">
              {item.value > 0 && (
                <span
                  className={`h-full rounded-r transition-all duration-500 ${strong ? 'bg-brand-600' : 'bg-slate-300'}`}
                  style={{ width: `${Math.max((item.value / max) * 100, 1.5)}%` }}
                />
              )}
            </span>
            <span className="text-right tabular-nums text-slate-800"><b className="font-semibold">{item.value}</b> <span className="text-xs text-slate-500">{share}%</span></span>
          </li>
        )
      })}
    </ul>
  )
}
