export interface ColumnSeries { name: string; color: string; values: number[] }

interface ColumnChartProps {
  labels: string[]
  series: ColumnSeries[]
  /** Rótulos do eixo a exibir (os demais ficam só na dica ao passar o mouse). */
  showLabel?: (index: number) => boolean
  /** Valores a escrever sobre as colunas; por padrão todos, quando são poucos grupos. */
  showValue?: (value: number, index: number) => boolean
  /** Texto da dica de cada grupo. */
  describe?: (index: number) => string
  height?: number
}

/** Colunas verticais em uma única escala, com uma ou mais séries lado a lado. */
export function ColumnChart({ labels, series, showLabel = () => true, showValue = () => true, describe, height = 180 }: ColumnChartProps) {
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />{s.name}</li>
          ))}
        </ul>
      )}
      <div className="flex items-end border-b border-slate-200" style={{ height }}>
        {labels.map((label, i) => (
          <div
            key={label}
            title={describe?.(i) ?? `${label}: ${series.map((s) => `${s.values[i]} ${s.name.toLowerCase()}`).join(' · ')}`}
            className="group flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-t hover:bg-slate-100/70"
          >
            {series.map((s) => {
              const value = s.values[i]
              return (
                <div key={s.name} className="flex h-full w-full max-w-6 flex-col items-center justify-end">
                  {showValue(value, i) && value > 0 && <span className="mb-1 text-[11px] font-medium tabular-nums text-slate-700">{value}</span>}
                  <div className={`w-full rounded-t ${s.color} transition-all duration-500`} style={{ height: `${(value / max) * 82}%`, minHeight: value > 0 ? 2 : 0 }} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex">
        {labels.map((label, i) => (
          <span key={label} className="min-w-0 flex-1 text-center text-[11px] whitespace-nowrap text-slate-500">{showLabel(i) ? label : ''}</span>
        ))}
      </div>
    </div>
  )
}
