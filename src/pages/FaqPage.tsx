import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Headphones, Plus, Search } from 'lucide-react'
import { FAQ } from '../data/faq'
import { normalize } from '../utils/format'
import { PageHeader } from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'

export function FaqPage() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<number | null>(0)
  const [topic, setTopic] = useState('')
  const topics = [...new Set(FAQ.map((f) => f.topic))]
  const list = FAQ.map((f, i) => ({ ...f, i })).filter((f) => (!topic || f.topic === topic) && normalize(`${f.q} ${f.a}`).includes(normalize(query)))

  return (
    <div className="animate-slide-up mx-auto max-w-4xl">
      <PageHeader crumbs={[{ label: 'Início', to: '/' }, { label: 'FAQ' }]} title="Perguntas frequentes" description="Encontre respostas rápidas antes de abrir um protocolo." />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input className="input py-3 pl-11 text-[15px]" placeholder="Digite sua dúvida..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {['', ...topics].map((t) => (
          <button key={t || 'all'} onClick={() => setTopic(t)} className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${topic === t ? 'bg-brand-deep text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300'}`}>{t || 'Todos'}</button>
        ))}
      </div>
      <div className="card divide-y divide-slate-100">
        {list.map((f) => (
          <div key={f.i}>
            <button onClick={() => setOpen(open === f.i ? null : f.i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50/60" aria-expanded={open === f.i}>
              <span className="font-medium text-slate-800">{f.q}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open === f.i ? 'rotate-180' : ''}`} />
            </button>
            {open === f.i && <p className="animate-fade-in px-5 pb-4 text-sm leading-relaxed text-slate-600">{f.a}</p>}
          </div>
        ))}
        {!list.length && <EmptyState icon={<Search className="h-6 w-6" />} title="Nenhuma resposta encontrada" description="Tente outras palavras ou abra um protocolo para falar com a equipe SAC." />}
      </div>
      <div className="card mt-6 flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Headphones className="h-5 w-5" /></span>
        <div className="flex-1"><p className="font-semibold text-slate-900">Não encontrou o que procurava?</p><p className="text-sm text-slate-500">Nossa equipe responde em média em menos de 30 minutos.</p></div>
        <Link to="/novo" className="btn-success"><Plus className="h-4 w-4" /> Abrir protocolo</Link>
      </div>
    </div>
  )
}
