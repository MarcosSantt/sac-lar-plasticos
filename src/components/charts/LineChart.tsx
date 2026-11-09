import { useLayoutEffect, useRef, useState } from 'react'

export interface ReferenceLine { label: string; value: number }

interface LineChartProps {
  labels: string[]
  /** Valores por posição; nulo = sem dado (a linha é interrompida). */
  values: (number | null)[]
  name: string
  format?: (v: number) => string
  /** Linhas horizontais de referência (meta, ano anterior), na mesma escala. */
  references?: ReferenceLine[]
  /** Posição em destaque (ex.: mês filtrado). */
  highlight?: number | null
  height?: number
}

const PAD = { top: 16, right: 16, bottom: 24, left: 40 }

/** Escala com 4 intervalos "redondos" (1, 2 ou 5 × 10ⁿ), para os rótulos do eixo saírem inteiros. */
function niceScale(v: number) {
  if (v <= 0) return { max: 4, step: 1 }
  const raw = v / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * p).find((m) => m >= raw) ?? raw
  return { max: step * Math.ceil(v / step), step }
}

/** Linha de uma série com mira e dica ao passar o mouse; referências em cinza com rótulo. */
export function LineChart({ labels, values, name, format = (v) => v.toLocaleString('pt-BR'), references = [], highlight = null, height = 200 }: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const data = values.filter((v): v is number => v != null)
  const { max, step } = niceScale(Math.max(...data, ...references.map((r) => r.value), 0) * 1.05)
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (labels.length > 1 ? (i / (labels.length - 1)) * plotW : plotW / 2)
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)

  // Segmentos contínuos (a linha não liga meses sem dado).
  const segments: string[] = []
  let current = ''
  values.forEach((v, i) => {
    if (v == null) { if (current) segments.push(current); current = ''; return }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  if (current) segments.push(current)
  const last = values.reduce<number>((acc, v, i) => (v != null ? i : acc), -1)

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = (e.clientX - box.left) / box.width
    setHover(Math.max(0, Math.min(labels.length - 1, Math.round(rel * (labels.length - 1)))))
  }

  const tip = hover != null ? { left: x(hover), value: values[hover] } : null

  return (
    <div ref={ref} className="relative" style={{ height }}>
      <svg width={width} height={height} role="img" aria-label={`${name} por mês`} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--gray-200)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={height - 6} textAnchor="middle" className={`text-[11px] ${i === highlight ? 'fill-slate-900 font-semibold' : 'fill-slate-500'}`}>{l}</text>
        ))}
        {highlight != null && <rect x={x(highlight) - 14} y={PAD.top} width={28} height={plotH} rx={4} fill="var(--green-50)" />}
        {references.map((r, i) => (
          // Rótulos alternam entre a direita e a esquerda para não se sobreporem quando as linhas são próximas.
          <g key={r.label}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(r.value)} y2={y(r.value)} stroke="var(--gray-400)" strokeWidth={1.5} />
            <text x={i % 2 ? PAD.left + 6 : width - PAD.right} y={y(r.value) - 5} textAnchor={i % 2 ? 'start' : 'end'} className="fill-slate-600 text-[11px]">{r.label}: {format(r.value)}</text>
          </g>
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--gray-300)" strokeWidth={1} />}
        {segments.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--green-600)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
        {values.map((v, i) => v != null && (i === last || i === hover || i === highlight) && (
          <circle key={i} cx={x(i)} cy={y(v)} r={4} fill="var(--green-600)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        {last >= 0 && hover == null && (
          <text x={x(last)} y={y(values[last]!) - 10} textAnchor={last === labels.length - 1 ? 'end' : 'middle'} className="fill-slate-900 text-[12px] font-semibold tabular-nums">{format(values[last]!)}</text>
        )}
        <rect x={PAD.left - 10} y={PAD.top} width={plotW + 20} height={plotH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 min-w-32 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg shadow-slate-900/10"
          style={{ left: Math.min(Math.max(tip.left, 70), width - 70), top: 0 }}
        >
          <p className="font-medium text-slate-500">{labels[hover!]}</p>
          <p className="mt-0.5 flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-brand-600" /><b className="text-[13px] text-slate-900 tabular-nums">{tip.value == null ? 'sem dado' : format(tip.value)}</b><span className="text-slate-500">{name}</span></p>
          {references.map((r) => <p key={r.label} className="mt-0.5 flex items-center gap-1.5 text-slate-500"><span className="h-0.5 w-3 rounded bg-slate-400" />{format(r.value)} {r.label}</p>)}
        </div>
      )}
    </div>
  )
}
