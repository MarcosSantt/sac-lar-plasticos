import { useState } from 'react'
import { Pencil, Plus, Power, Search, Tags } from 'lucide-react'
import type { Category } from '../types'
import { useStore } from '../store/StoreContext'
import { normalize } from '../utils/format'
import { Modal } from './Modal'
import { FormField } from './FormField'
import { ActiveBadge, StatusSwitch } from './ActiveToggle'
import { EmptyState } from './EmptyState'
import { useToast } from './Toast'

const EMPTY: Category = { id: '', name: '', description: '', active: true }

export function CategoryManager() {
  const { categories, protocols, saveCategory } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<Category | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const usage = (id: string) => protocols.filter((p) => p.categoryId === id).length
  const list = categories.filter((c) => normalize(`${c.name} ${c.description}`).includes(normalize(query)))

  const save = async () => {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) return setError('Informe o nome da categoria.')
    if (categories.some((c) => c.id !== editing.id && normalize(c.name) === normalize(name))) return setError('Já existe uma categoria com este nome.')
    const isNew = !editing.id
    if (!(await saveCategory({ ...editing, name, description: editing.description.trim() }))) return
    toast({ variant: 'success', title: isNew ? 'Categoria criada' : 'Categoria atualizada', description: isNew ? `"${name}" já está disponível no formulário de abertura de SAC.` : `As alterações em "${name}" foram salvas.` })
    setEditing(null)
  }

  const toggle = async (c: Category) => {
    if (!(await saveCategory({ ...c, active: !c.active }))) return
    toast({ variant: 'success', title: c.active ? 'Categoria desativada' : 'Categoria ativada', description: c.active ? `"${c.name}" não aparecerá mais em novos protocolos.` : `"${c.name}" voltou a aparecer no formulário.` })
  }

  const open = (c: Category) => { setError(''); setEditing({ ...c }) }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Categorias de SAC</h1>
          <p className="mt-1 text-sm text-slate-500">Categorias ativas aparecem automaticamente no formulário de abertura de protocolo.</p>
        </div>
        <button className="btn-primary" onClick={() => open(EMPTY)}><Plus className="h-4 w-4" /> Nova categoria</button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar categoria..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">{categories.filter((c) => c.active).length} ativas de {categories.length}</span>
        </div>
        {list.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50/70">
                <tr><th className="th">Categoria</th><th className="th">Descrição</th><th className="th">Protocolos</th><th className="th">Status</th><th className="th text-right">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((c) => (
                  <tr key={c.id} className={`animate-fade-in transition-colors hover:bg-brand-50/70 ${c.active ? '' : 'opacity-70'}`}>
                    <td className="td font-medium text-slate-900">{c.name}</td>
                    <td className="td max-w-md text-slate-600">{c.description || <span className="text-slate-400">—</span>}</td>
                    <td className="td text-slate-600">{usage(c.id)}</td>
                    <td className="td"><ActiveBadge active={c.active} labels={['Ativa', 'Inativa']} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => open(c)}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                        <button className={`btn-ghost px-2.5 py-1.5 text-xs ${c.active ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-brand-50 hover:text-brand-700'}`} onClick={() => toggle(c)}>
                          <Power className="h-3.5 w-3.5" /> {c.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<Tags className="h-6 w-6" />} title="Nenhuma categoria encontrada" />}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar categoria' : 'Nova categoria'}
        description="Categorias organizam os protocolos e alimentam os relatórios do SAC."
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar categoria</button></>}
      >
        {editing && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }}>
            <FormField label="Nome da categoria" required error={error} htmlFor="cat-name">
              <input id="cat-name" autoFocus className={`input ${error ? 'input-error' : ''}`} value={editing.name} onChange={(e) => { setError(''); setEditing({ ...editing, name: e.target.value }) }} placeholder="Ex.: Garantia" />
            </FormField>
            <FormField label="Descrição" htmlFor="cat-desc">
              <textarea id="cat-desc" rows={3} className="input resize-none" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Quando esta categoria deve ser usada?" />
            </FormField>
            <div>
              <span className="label">Status</span>
              <StatusSwitch checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} labels={['Ativa', 'Inativa']} />
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
