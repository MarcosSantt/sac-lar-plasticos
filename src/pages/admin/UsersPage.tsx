import { useState } from 'react'
import { Pencil, Plus, Power } from 'lucide-react'
import type { User } from '../../types'
import { useStore } from '../../store/StoreContext'
import { uid } from '../../utils/format'
import { OPEN_STATUSES } from '../../utils/protocol'
import { Modal } from '../../components/Modal'
import { FormField } from '../../components/FormField'
import { ActiveBadge, StatusSwitch } from '../../components/ActiveToggle'
import { Avatar } from '../../components/Avatar'
import { useToast } from '../../components/Toast'

const EMPTY: User = { id: '', name: '', email: '', department: 'SAC', role: 'agent', title: 'Atendente SAC', active: true }
const ROLE_LABEL = { agent: 'Equipe SAC', requester: 'Solicitante' }

export function UsersPage() {
  const { users, protocols, saveUser, currentUser } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<User | null>(null)
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'title', string>>>({})

  const openCount = (u: User) => protocols.filter((p) => OPEN_STATUSES.includes(p.status) && (u.role === 'agent' ? p.responsibleId === u.id : p.requester.email === u.email)).length

  const save = () => {
    if (!editing) return
    const e: typeof errors = {}
    if (!editing.name.trim()) e.name = 'Informe o nome.'
    if (!/^\S+@\S+\.\S+$/.test(editing.email.trim())) e.email = 'Informe um e-mail válido.'
    if (!editing.title.trim()) e.title = 'Informe o cargo ou perfil.'
    setErrors(e)
    if (Object.keys(e).length) return
    const isNew = !editing.id
    saveUser({ ...editing, id: editing.id || uid('u'), name: editing.name.trim(), email: editing.email.trim() })
    toast({ variant: 'success', title: isNew ? 'Usuário criado' : 'Usuário atualizado', description: isNew ? `${editing.name} já pode ser selecionado em "Alternar perfil".` : 'Alterações salvas.' })
    setEditing(null)
  }

  const toggle = (u: User) => {
    if (u.id === currentUser.id) return toast({ variant: 'error', title: 'Ação não permitida', description: 'Você não pode desativar o usuário com o qual está conectado.' })
    saveUser({ ...u, active: !u.active })
    toast({ variant: 'success', title: u.active ? 'Usuário desativado' : 'Usuário ativado', description: u.name })
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Usuários</h1>
          <p className="mt-1 text-sm text-slate-500">Equipe de atendimento e solicitantes com acesso ao portal. Atendentes ativos recebem protocolos pela distribuição automática.</p>
        </div>
        <button className="btn-primary" onClick={() => { setErrors({}); setEditing({ ...EMPTY }) }}><Plus className="h-4 w-4" /> Novo usuário</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50/70">
            <tr><th className="th">Usuário</th><th className="th">Perfil</th><th className="th">Cargo</th><th className="th">Em aberto</th><th className="th">Status</th><th className="th text-right">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={`hover:bg-brand-50/70 ${u.active ? '' : 'opacity-70'}`}>
                <td className="td">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={u.name} size="sm" />
                    <span><span className="block font-medium text-slate-900">{u.name}{u.id === currentUser.id && <span className="ml-1.5 rounded bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700">VOCÊ</span>}</span><span className="block text-xs text-slate-500">{u.email}</span></span>
                  </span>
                </td>
                <td className="td"><span className={`rounded-md px-2 py-0.5 text-xs font-medium ${u.role === 'agent' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>{ROLE_LABEL[u.role]}</span></td>
                <td className="td text-slate-600">{u.title}</td>
                <td className="td text-slate-600">{openCount(u)}</td>
                <td className="td"><ActiveBadge active={u.active} /></td>
                <td className="td">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => { setErrors({}); setEditing({ ...u }) }}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                    <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => toggle(u)}><Power className="h-3.5 w-3.5" /> {u.active ? 'Desativar' : 'Ativar'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar usuário' : 'Novo usuário'}
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar usuário</button></>}
      >
        {editing && (
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save() }}>
            <FormField label="Nome" required error={errors.name} className="sm:col-span-2" htmlFor="us-name">
              <input id="us-name" autoFocus className={`input ${errors.name ? 'input-error' : ''}`} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </FormField>
            <FormField label="E-mail" required error={errors.email} className="sm:col-span-2" htmlFor="us-email">
              <input id="us-email" className={`input ${errors.email ? 'input-error' : ''}`} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </FormField>
            <FormField label="Perfil" required htmlFor="us-role">
              <select id="us-role" className="input" value={editing.role} onChange={(e) => {
                const role = e.target.value as User['role']
                setEditing({ ...editing, role, department: role === 'agent' ? 'SAC' : 'Cliente', title: role === 'agent' ? 'Atendente SAC' : 'Solicitante' })
              }}>
                <option value="agent">Equipe SAC</option>
                <option value="requester">Solicitante</option>
              </select>
            </FormField>
            <FormField label="Cargo" required error={errors.title} htmlFor="us-title">
              <input id="us-title" className={`input ${errors.title ? 'input-error' : ''}`} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </FormField>
            <div><span className="label">Status</span><StatusSwitch checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} /></div>
          </form>
        )}
      </Modal>
    </div>
  )
}
