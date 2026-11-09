import { useState } from 'react'
import { Save } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { FormField } from '../../components/FormField'
import { useToast } from '../../components/Toast'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

/** Números com vírgula decimal; vazio vira nulo. */
const parse = (v: string) => (v.trim() ? Number(v.replace(/\./g, '').replace(',', '.')) : null)
const show = (v: number | null | undefined) => (v == null ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }))

function YearForm({ year }: { year: number }) {
  const { goals, production, saveGoals } = useStore()
  const toast = useToast()
  const g = goals.find((x) => x.year === year)
  const [form, setForm] = useState({
    prevSac: show(g?.prevSac), prevFc: show(g?.prevFc), sacReductionPct: show(g?.sacReductionPct), fcReductionPct: show(g?.fcReductionPct),
    prevPpm: show(g?.prevPpm), ppmReductionPct: show(g?.ppmReductionPct),
  })
  const [months, setMonths] = useState(() => MONTHS.map((_, i) => show(production.find((p) => p.year === year && p.month === i + 1)?.kg)))
  const [error, setError] = useState('')
  const set = (k: keyof typeof form, v: string) => { setForm((f) => ({ ...f, [k]: v })); setError('') }

  const values = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, parse(v) ?? 0])) as Record<keyof typeof form, number>
  const sacLimit = Math.round(values.prevSac * (1 - values.sacReductionPct / 100))
  const fcLimit = Math.round(values.prevFc * (1 - values.fcReductionPct / 100))
  const ppmTarget = values.prevPpm * (1 - values.ppmReductionPct / 100)

  const save = async () => {
    const kg = months.map(parse)
    if (Object.values(values).some((v) => !Number.isFinite(v) || v < 0) || kg.some((v) => v != null && (!Number.isFinite(v) || v < 0))) return setError('Use apenas números positivos, como 1.933 ou 237,67.')
    if ([values.sacReductionPct, values.fcReductionPct, values.ppmReductionPct].some((v) => v > 100)) return setError('As reduções vão de 0% a 100%.')
    if (!Number.isInteger(values.prevSac) || !Number.isInteger(values.prevFc)) return setError('Os totais do ano anterior são números inteiros.')
    if (await saveGoals(year, { ...values, production: kg })) toast({ variant: 'success', title: 'Metas salvas', description: `Metas e produção de ${year} atualizadas.` })
  }

  const field = (k: keyof typeof form, label: string, hint?: string) => (
    <FormField label={label} htmlFor={`g-${k}`} hint={hint}>
      <input id={`g-${k}`} inputMode="decimal" className="input text-right tabular-nums" value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </FormField>
  )

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Metas de {year}</h2>
        <p className="mt-0.5 text-xs text-slate-500">Os limites saem do total do ano anterior menos a redução pretendida.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {field('prevSac', `Total de SAC em ${year - 1}`)}
          {field('sacReductionPct', 'Redução de SAC (%)', `Limite em ${year}: ${sacLimit.toLocaleString('pt-BR')}`)}
          <div className="hidden sm:block" />
          {field('prevFc', `Falta de componente em ${year - 1}`)}
          {field('fcReductionPct', 'Redução de FC (%)', `Limite em ${year}: ${fcLimit.toLocaleString('pt-BR')}`)}
          <div className="hidden sm:block" />
          {field('prevPpm', `PPM de ${year - 1}`)}
          {field('ppmReductionPct', 'Redução de PPM (%)', `Meta em ${year}: ${ppmTarget.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`)}
        </div>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Produção mensal (kg)</h2>
        <p className="mt-0.5 text-xs text-slate-500">Plástico produzido em cada mês, base do PPM de SAC. Deixe em branco os meses ainda não fechados.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {MONTHS.map((m, i) => (
            <FormField key={m} label={m} htmlFor={`kg-${i}`}>
              <input id={`kg-${i}`} inputMode="decimal" className="input text-right tabular-nums" value={months[i]} onChange={(e) => { setMonths((l) => l.map((v, j) => (j === i ? e.target.value : v))); setError('') }} />
            </FormField>
          ))}
        </div>
      </section>
      <div className="flex items-center justify-end gap-3">
        {error && <p className="text-[13px] text-red-600">{error}</p>}
        <button className="btn-primary" onClick={save}><Save className="h-4 w-4" /> Salvar {year}</button>
      </div>
    </div>
  )
}

export function GoalsPage() {
  const { goals } = useStore()
  const current = new Date().getFullYear()
  const years = [...new Set([current + 1, current, ...goals.map((g) => g.year)])].sort((a, b) => b - a)
  const [year, setYear] = useState(current)
  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Metas e produção</h1>
          <p className="mt-1 text-sm text-slate-500">Alimentam a seção Objetivos e Metas do dashboard (limites de SAC e de falta de componente, PPM).</p>
        </div>
        <label className="w-32"><span className="label">Ano</span>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
        </label>
      </div>
      <YearForm key={year} year={year} />
    </div>
  )
}
