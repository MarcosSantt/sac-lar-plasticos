import { useState } from 'react'
import { ListChecks, Pencil, Plus, Power, Search } from 'lucide-react'
import type { Lookup, LookupKind, ProtocolItem } from '../../types'
import { useStore } from '../../store/StoreContext'
import { normalize } from '../../utils/format'
import { Modal } from '../../components/Modal'
import { FormField } from '../../components/FormField'
import { ActiveBadge, StatusSwitch } from '../../components/ActiveToggle'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'

const KINDS: { kind: LookupKind; label: string; hint: string; code?: string }[] = [
  { kind: 'failure_mode', label: 'Modos de falha', hint: 'O que aconteceu com o item. "FALTA DE COMPONENTE" alimenta a meta de FC.' },
  { kind: 'area', label: 'Áreas responsáveis', hint: 'Setor que originou o desvio, com o código do centro de resultado.', code: 'Centro de resultado' },
  { kind: 'treatment', label: 'Tratativas', hint: 'Como cada item foi resolvido.' },
  { kind: 'location', label: 'Locais da peça', hint: 'Parte do produto afetada.' },
  { kind: 'machinery', label: 'Maquinário', hint: 'Processo de fabricação do item.' },
  { kind: 'unit', label: 'Unidades', hint: 'Matriz ou filial que atendeu a venda.' },
  { kind: 'return_method', label: 'Logística de retorno', hint: 'Como o item volta ou a reposição é enviada (pós).' },
]

export function LookupsPage() {
  const { lookups, protocols, saveLookup } = useStore()
  const toast = useToast()
  const [kind, setKind] = useState<LookupKind>('failure_mode')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Lookup | null>(null)
  const [error, setError] = useState('')
  const meta = KINDS.find((k) => k.kind === kind)!

  const list = lookups.filter((l) => l.kind === kind && normalize(`${l.name} ${l.code}`).includes(normalize(query)))
  const field: Record<LookupKind, (i: ProtocolItem) => string> = {
    failure_mode: (i) => i.failureMode, area: (i) => i.responsibleArea, treatment: (i) => i.treatment, location: (i) => i.location,
    machinery: (i) => i.machinery, unit: () => '', return_method: () => '',
  }
  const usage = (l: Lookup) => {
    if (l.kind === 'unit') return protocols.filter((p) => p.unit === l.name).length
    if (l.kind === 'return_method') return protocols.filter((p) => p.returnMethod === l.name).length
    return protocols.reduce((n, p) => n + p.items.filter((i) => field[l.kind](i) === l.name).length, 0)
  }

  const save = async () => {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) return setError('Informe o nome.')
    if (lookups.some((l) => l.kind === kind && l.id !== editing.id && normalize(l.name) === normalize(name))) return setError('Esta opção já existe na lista.')
    const isNew = !editing.id
    if (!(await saveLookup({ ...editing, name, code: editing.code.trim() }))) return
    toast({ variant: 'success', title: isNew ? 'Opção criada' : 'Opção atualizada', description: name })
    setEditing(null)
  }

  const toggle = async (l: Lookup) => {
    if (!(await saveLookup({ ...l, active: !l.active }))) return
    toast({ variant: 'success', title: l.active ? 'Opção desativada' : 'Opção ativada', description: l.active ? `"${l.name}" não aparece em novas classificações. Os itens já classificados continuam com ela.` : l.name })
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Listas de classificação</h1>
          <p className="mt-1 text-sm text-slate-500">Opções que a equipe SAC usa ao classificar os itens e que agrupam os indicadores do dashboard.</p>
        </div>
        <button className="btn-primary" onClick={() => { setError(''); setEditing({ id: '', kind, name: '', code: '', active: true }) }}><Plus className="h-4 w-4" /> Nova opção</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
        {KINDS.map((k) => (
          <button key={k.kind} role="tab" aria-selected={kind === k.kind} onClick={() => { setKind(k.kind); setQuery('') }}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${kind === k.kind ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            {k.label} <span className={kind === k.kind ? 'text-white/75' : 'text-slate-400'}>{lookups.filter((l) => l.kind === k.kind && l.active).length}</span>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <p className="text-[13px] text-slate-500">{meta.hint}</p>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {list.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50/70">
                <tr><th className="th">Nome</th>{meta.code && <th className="th">{meta.code}</th>}<th className="th">Em uso</th><th className="th">Status</th><th className="th text-right">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((l) => (
                  <tr key={l.id} className={`hover:bg-brand-50/70 ${l.active ? '' : 'opacity-70'}`}>
                    <td className="td font-medium text-slate-900">{l.name}</td>
                    {meta.code && <td className="td font-mono text-xs text-slate-600">{l.code || '—'}</td>}
                    <td className="td text-slate-600">{usage(l)}</td>
                    <td className="td"><ActiveBadge active={l.active} labels={['Ativa', 'Inativa']} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => { setError(''); setEditing({ ...l }) }}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                        <button className={`btn-ghost px-2.5 py-1.5 text-xs ${l.active ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-brand-50 hover:text-brand-700'}`} onClick={() => toggle(l)}>
                          <Power className="h-3.5 w-3.5" /> {l.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Nenhuma opção encontrada" />}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar opção' : `Nova opção · ${meta.label}`}
        description={editing?.id ? 'Renomear não altera os itens já classificados: eles guardam o nome usado na época.' : undefined}
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}
      >
        {editing && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }}>
            <FormField label="Nome" required error={error} htmlFor="lk-name">
              <input id="lk-name" autoFocus className={`input ${error ? 'input-error' : ''}`} value={editing.name} onChange={(e) => { setError(''); setEditing({ ...editing, name: e.target.value }) }} maxLength={120} />
            </FormField>
            {meta.code && (
              <FormField label={meta.code} htmlFor="lk-code">
                <input id="lk-code" className="input" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} maxLength={40} />
              </FormField>
            )}
            <div><span className="label">Status</span><StatusSwitch checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} labels={['Ativa', 'Inativa']} /></div>
          </form>
        )}
      </Modal>
    </div>
  )
}
