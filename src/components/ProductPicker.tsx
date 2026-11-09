import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, Package, Search, X } from 'lucide-react'
import type { Product } from '../types'
import { useStore } from '../store/StoreContext'

interface ProductPickerProps {
  value: Product | null
  onChange: (p: Product | null) => void
  invalid?: boolean
  id?: string
  name?: string
}

/** Busca no catálogo de produtos por código ou parte da descrição. */
export function ProductPicker({ value, onChange, invalid, id, name }: ProductPickerProps) {
  const { searchProducts } = useStore()
  // A função do store é recriada a cada atualização; a busca não deve repetir por isso.
  const search = useRef(searchProducts)
  useEffect(() => { search.current = searchProducts })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      search.current(q)
        .then((list) => { if (!cancelled) { setResults(list); setActive(0) } })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query])

  useEffect(() => {
    const onClick = (e: MouseEvent) => boxRef.current && !boxRef.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const choose = (p: Product) => {
    onChange(p)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  if (value) {
    return (
      <div className={`flex min-h-[38px] items-center gap-2.5 rounded-lg border bg-white px-3 py-1.5 ${invalid ? 'border-red-300' : 'border-slate-300'}`}>
        <Package className="h-4 w-4 shrink-0 text-brand-600" />
        <span className="min-w-0 flex-1 text-[13px] leading-tight">
          <span className="block truncate font-medium text-slate-800">{value.name}</span>
          <span className="block text-[11px] text-slate-500">Cód. {value.code}{value.family && ` · ${value.family}`}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Trocar produto"><X className="h-4 w-4" /></button>
      </div>
    )
  }

  const showList = open && query.trim().length >= 2
  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        id={id}
        name={name}
        className={`input pl-9 ${invalid ? 'input-error' : ''}`}
        placeholder="Código ou descrição do produto"
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={(e) => {
          if (!showList || !results.length) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter') { e.preventDefault(); choose(results[active]) }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {loading && <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full animate-pop-in overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10">
          {results.map((p, i) => (
            <li key={p.code} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
                className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-[13px] ${i === active ? 'bg-brand-50' : ''}`}
              >
                <span className="w-14 shrink-0 font-mono text-xs text-slate-500">{p.code}</span>
                <span className="min-w-0 flex-1 truncate text-slate-800">{p.name}</span>
                {p.family && <span className="shrink-0 text-[11px] text-slate-400">{p.family}</span>}
              </button>
            </li>
          ))}
          {!loading && !results.length && <li className="px-3 py-2 text-[13px] text-slate-500">Nenhum produto encontrado.</li>}
        </ul>
      )}
    </div>
  )
}
