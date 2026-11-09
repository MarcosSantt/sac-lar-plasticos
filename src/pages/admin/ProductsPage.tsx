import { useEffect, useState } from 'react'
import { Loader2, Package, Pencil, Plus, Power, Search } from 'lucide-react'
import type { Product } from '../../types'
import { useStore } from '../../store/StoreContext'
import { api } from '../../api/client'
import { Modal } from '../../components/Modal'
import { FormField } from '../../components/FormField'
import { ActiveBadge, StatusSwitch } from '../../components/ActiveToggle'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'

type Row = Required<Product>

export function ProductsPage() {
  const { saveProduct } = useStore()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [editing, setEditing] = useState<{ product: Row; isNew: boolean } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      api.get<{ products: Row[]; total: number }>(`/admin/products?q=${encodeURIComponent(query.trim())}`)
        .then((r) => { if (!cancelled) { setRows(r.products); setTotal(r.total) } })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, reload])

  const save = async () => {
    if (!editing) return
    const p = { ...editing.product, code: editing.product.code.trim(), name: editing.product.name.trim(), family: editing.product.family.trim() }
    if (!p.code || !p.name) return setError('Informe o código e a descrição.')
    if (!(await saveProduct(p, editing.isNew))) return
    toast({ variant: 'success', title: editing.isNew ? 'Produto cadastrado' : 'Produto atualizado', description: p.name })
    setEditing(null)
    setReload((n) => n + 1)
  }

  const toggle = async (p: Row) => {
    if (!(await saveProduct({ ...p, active: !p.active }, false))) return
    setReload((n) => n + 1)
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Produtos</h1>
          <p className="mt-1 text-sm text-slate-500">Catálogo usado na abertura do SAC. A família agrupa os produtos no dashboard; produtos sem família aparecem como itens sem família.</p>
        </div>
        <button className="btn-primary" onClick={() => { setError(''); setEditing({ product: { code: '', name: '', family: '', active: true }, isNew: true }) }}><Plus className="h-4 w-4" /> Novo produto</button>
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Código, descrição ou família..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {total > rows.length ? `Mostrando ${rows.length} de ${total.toLocaleString('pt-BR')}` : `${total.toLocaleString('pt-BR')} produto(s)`}
          </span>
        </div>
        {rows.length ? (
          <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50/70">
                <tr><th className="th">Código</th><th className="th">Descrição</th><th className="th">Família</th><th className="th">Status</th><th className="th text-right">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.code} className={`hover:bg-brand-50/70 ${p.active ? '' : 'opacity-70'}`}>
                    <td className="td font-mono text-xs text-slate-600">{p.code}</td>
                    <td className="td font-medium text-slate-900">{p.name}</td>
                    <td className="td text-slate-600">{p.family || <span className="text-slate-400">—</span>}</td>
                    <td className="td"><ActiveBadge active={p.active} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => { setError(''); setEditing({ product: { ...p }, isNew: false }) }}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => toggle(p)}><Power className="h-3.5 w-3.5" /> {p.active ? 'Desativar' : 'Ativar'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading && <EmptyState icon={<Package className="h-6 w-6" />} title="Nenhum produto encontrado" />}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'Novo produto' : 'Editar produto'}
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}
      >
        {editing && (
          <form className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]" onSubmit={(e) => { e.preventDefault(); save() }}>
            <FormField label="Código" required htmlFor="pr-code">
              <input id="pr-code" className="input font-mono" disabled={!editing.isNew} value={editing.product.code} onChange={(e) => setEditing({ ...editing, product: { ...editing.product, code: e.target.value } })} maxLength={40} />
            </FormField>
            <FormField label="Descrição" required htmlFor="pr-name">
              <input id="pr-name" autoFocus className="input" value={editing.product.name} onChange={(e) => setEditing({ ...editing, product: { ...editing.product, name: e.target.value } })} maxLength={200} />
            </FormField>
            <FormField label="Família" htmlFor="pr-family" className="sm:col-span-2" hint="Ex.: Lixeira com pedal, Coletor, Cx. Organizadora">
              <input id="pr-family" className="input" value={editing.product.family} onChange={(e) => setEditing({ ...editing, product: { ...editing.product, family: e.target.value } })} maxLength={80} />
            </FormField>
            <div><span className="label">Status</span><StatusSwitch checked={editing.product.active} onChange={(v) => setEditing({ ...editing, product: { ...editing.product, active: v } })} /></div>
            {error && <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p>}
            {!editing.isNew && <p className="text-xs text-slate-500 sm:col-span-2">Itens já registrados mantêm a descrição e a família da época da abertura.</p>}
          </form>
        )}
      </Modal>
    </div>
  )
}
