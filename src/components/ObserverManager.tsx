import { useState } from 'react'
import { Eye, KeyRound, Pencil, Plus, Power, Search } from 'lucide-react'
import type { Observer } from '../types'
import { useStore } from '../store/StoreContext'
import { normalize } from '../utils/format'
import { Modal } from './Modal'
import { FormField } from './FormField'
import { ActiveBadge, StatusSwitch } from './ActiveToggle'
import { EmptyState } from './EmptyState'
import { Avatar } from './Avatar'
import { TemporaryPasswordModal, type TemporaryPassword } from './TemporaryPasswordModal'
import { useToast } from './Toast'

const EMPTY: Observer = { id: '', name: '', email: '', department: '', active: true }
const DEPARTMENTS = ['Financeiro', 'Comercial', 'Logística', 'Qualidade', 'Jurídico', 'Marketing', 'Produto', 'Diretoria', 'TI']

type Errors = Partial<Record<'name' | 'email' | 'department', string>>

export function ObserverManager() {
  const { observers, protocols, saveAccount, resetPassword } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<Observer | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [query, setQuery] = useState('')
  const [temporary, setTemporary] = useState<TemporaryPassword | null>(null)
  const [resetting, setResetting] = useState<Observer | null>(null)

  const list = observers.filter((o) => normalize(`${o.name} ${o.email} ${o.department}`).includes(normalize(query)))
  const following = (id: string) => protocols.filter((p) => p.observerIds.includes(id)).length

  const save = async () => {
    if (!editing) return
    const e: Errors = {}
    if (!editing.name.trim()) e.name = 'Informe o nome do observador.'
    if (!/^\S+@\S+\.\S+$/.test(editing.email.trim())) e.email = 'Informe um e-mail válido.'
    else if (observers.some((o) => o.id !== editing.id && o.email.toLowerCase() === editing.email.trim().toLowerCase())) e.email = 'Este e-mail já está cadastrado.'
    if (!editing.department.trim()) e.department = 'Selecione ou informe o departamento.'
    setErrors(e)
    if (Object.keys(e).length) return
    const account = { ...editing, name: editing.name.trim(), email: editing.email.trim(), department: editing.department.trim() }
    const result = await saveAccount({ ...account, role: 'observer', title: 'Observador' })
    if (!result) return
    setEditing(null)
    if (result.temporaryPassword) setTemporary({ name: account.name, email: account.email, password: result.temporaryPassword })
    else toast({ variant: 'success', title: 'Observador atualizado', description: 'Alterações salvas.' })
  }

  const confirmReset = async () => {
    if (!resetting) return
    const o = resetting
    setResetting(null)
    const password = await resetPassword(o.id)
    if (password) setTemporary({ name: o.name, email: o.email, password })
  }

  const toggle = async (o: Observer) => {
    if (!(await saveAccount({ ...o, role: 'observer', title: 'Observador', active: !o.active }))) return
    toast({ variant: 'success', title: o.active ? 'Observador desativado' : 'Observador ativado', description: o.name })
  }

  const open = (o: Observer) => { setErrors({}); setEditing({ ...o }) }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Observadores</h1>
          <p className="mt-1 text-sm text-slate-500">Pessoas que podem acompanhar e participar dos protocolos, como em cópia (CC) de um e-mail.</p>
        </div>
        <button className="btn-primary" onClick={() => open(EMPTY)}><Plus className="h-4 w-4" /> Novo observador</button>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Buscar por nome, e-mail ou área..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {list.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50/70">
                <tr><th className="th">Nome</th><th className="th">E-mail</th><th className="th">Departamento</th><th className="th">Protocolos</th><th className="th">Status</th><th className="th text-right">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((o) => (
                  <tr key={o.id} className={`animate-fade-in hover:bg-brand-50/70 ${o.active ? '' : 'opacity-70'}`}>
                    <td className="td"><span className="flex items-center gap-2.5 font-medium whitespace-nowrap text-slate-900"><Avatar name={o.name} size="sm" />{o.name}</span></td>
                    <td className="td text-slate-600">{o.email}</td>
                    <td className="td"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{o.department}</span></td>
                    <td className="td text-slate-600">{following(o.id)}</td>
                    <td className="td"><ActiveBadge active={o.active} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => open(o)}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setResetting(o)}><KeyRound className="h-3.5 w-3.5" /> Redefinir senha</button>
                        <button className={`btn-ghost px-2.5 py-1.5 text-xs ${o.active ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-brand-50 hover:text-brand-700'}`} onClick={() => toggle(o)}>
                          <Power className="h-3.5 w-3.5" /> {o.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<Eye className="h-6 w-6" />} title="Nenhum observador encontrado" />}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar observador' : 'Novo observador'}
        description={editing?.id ? 'Observadores ativos aparecem na abertura de protocolos.' : 'O observador recebe um login próprio; ao salvar, o portal gera a senha provisória.'}
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar observador</button></>}
      >
        {editing && (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save() }}>
            <FormField label="Nome" required error={errors.name} htmlFor="ob-name" className="sm:col-span-2">
              <input id="ob-name" autoFocus className={`input ${errors.name ? 'input-error' : ''}`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Nome completo" />
            </FormField>
            <FormField label="E-mail" required error={errors.email} htmlFor="ob-email" className="sm:col-span-2">
              <input id="ob-email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="nome@larplasticos.com.br" />
            </FormField>
            <FormField label="Departamento" required error={errors.department} htmlFor="ob-dep">
              <input id="ob-dep" list="departments" className={`input ${errors.department ? 'input-error' : ''}`} value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value })} placeholder="Selecione ou digite" />
              <datalist id="departments">{DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist>
            </FormField>
            <div>
              <span className="label">Status</span>
              <div className="pt-1.5"><StatusSwitch checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} /></div>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={!!resetting}
        onClose={() => setResetting(null)}
        title="Redefinir senha?"
        size="sm"
        footer={<><button className="btn-secondary" onClick={() => setResetting(null)}>Cancelar</button><button className="btn-primary" onClick={confirmReset}>Redefinir</button></>}
      >
        <p className="text-sm text-slate-600">A senha atual de <b className="font-semibold text-slate-900">{resetting?.name}</b> deixa de funcionar e as sessões abertas são encerradas. Uma nova senha provisória será gerada.</p>
      </Modal>

      <TemporaryPasswordModal value={temporary} onClose={() => setTemporary(null)} />
    </div>
  )
}
