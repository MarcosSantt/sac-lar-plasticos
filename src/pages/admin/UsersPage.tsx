import { useState } from 'react'
import { KeyRound, Pencil, Plus, Power } from 'lucide-react'
import type { User } from '../../types'
import { useStore } from '../../store/StoreContext'
import { OPEN_STATUSES } from '../../utils/protocol'
import { Modal } from '../../components/Modal'
import { FormField } from '../../components/FormField'
import { ActiveBadge, StatusSwitch } from '../../components/ActiveToggle'
import { Avatar } from '../../components/Avatar'
import { TemporaryPasswordModal, type TemporaryPassword } from '../../components/TemporaryPasswordModal'
import { useToast } from '../../components/Toast'
import { ACCOUNT_ROLE_LABEL } from '../../utils/access'

type Role = User['role']

const EMPTY: User = { id: '', name: '', email: '', department: 'SAC', role: 'agent', title: 'Atendente SAC', isAdmin: false, active: true, teamIds: [] }

/** Valores sugeridos ao trocar o perfil no formulário. */
const ROLE_DEFAULTS: Record<Role, { department: string; title: string }> = {
  agent: { department: 'SAC', title: 'Atendente SAC' },
  seller: { department: 'Comercial', title: 'Vendedor' },
  post_sales: { department: 'Pós-vendas', title: 'Pós-vendas' },
  coordinator: { department: 'Comercial', title: 'Coordenador' },
}

const ROLE_HINT: Record<Role, string> = {
  agent: 'Atende os protocolos e vê todos eles. Inclui a coordenação de SAC.',
  seller: 'Abre protocolos e vê apenas os que abriu.',
  post_sales: 'Abre protocolos e vê os das equipes que acompanha.',
  coordinator: 'Vê e responde os protocolos das equipes que coordena, sem alterar status.',
}

const ROLE_BADGE: Record<Role, string> = {
  agent: 'bg-brand-50 text-brand-700',
  seller: 'bg-slate-100 text-slate-600',
  post_sales: 'bg-blue-50 text-blue-700',
  coordinator: 'bg-amber-50 text-amber-800',
}

export function UsersPage() {
  const { users, teams, protocols, saveAccount, resetPassword, currentUser } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<User | null>(null)
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'title' | 'teamIds', string>>>({})
  const [temporary, setTemporary] = useState<TemporaryPassword | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)

  const openCount = (u: User) => protocols.filter((p) => OPEN_STATUSES.includes(p.status) && (
    u.role === 'agent' ? p.responsibleId === u.id
      : u.role === 'coordinator' ? !!p.teamId && u.teamIds.includes(p.teamId)
        : p.requesterId === u.id)).length
  const teamNames = (u: User) => teams.filter((t) => u.teamIds.includes(t.id)).map((t) => t.name).join(', ')
  // Equipes inativas continuam visíveis para quem já está vinculado a elas.
  const selectableTeams = (u: User) => teams.filter((t) => t.active || u.teamIds.includes(t.id))
  const toggleTeam = (id: string) => editing && setEditing({
    ...editing, teamIds: editing.teamIds.includes(id) ? editing.teamIds.filter((t) => t !== id) : [...editing.teamIds, id],
  })

  const save = async () => {
    if (!editing) return
    const e: typeof errors = {}
    if (!editing.name.trim()) e.name = 'Informe o nome.'
    if (!/^\S+@\S+\.\S+$/.test(editing.email.trim())) e.email = 'Informe um e-mail válido.'
    if (!editing.title.trim()) e.title = 'Informe o cargo ou perfil.'
    if (editing.role === 'seller' && editing.teamIds.length !== 1) e.teamIds = 'Selecione a equipe do vendedor.'
    if ((editing.role === 'coordinator' || editing.role === 'post_sales') && !editing.teamIds.length) e.teamIds = 'Selecione ao menos uma equipe.'
    setErrors(e)
    if (Object.keys(e).length) return
    const account = { ...editing, name: editing.name.trim(), email: editing.email.trim(), title: editing.title.trim(), department: editing.department.trim() }
    const result = await saveAccount(account)
    if (!result) return
    setEditing(null)
    if (result.temporaryPassword) setTemporary({ name: account.name, email: account.email, password: result.temporaryPassword })
    else toast({ variant: 'success', title: 'Usuário atualizado', description: 'Alterações salvas.' })
  }

  const toggle = async (u: User) => {
    if (u.id === currentUser.id) return toast({ variant: 'error', title: 'Ação não permitida', description: 'Você não pode desativar o usuário com o qual está conectado.' })
    if (!(await saveAccount({ ...u, active: !u.active }))) return
    toast({ variant: 'success', title: u.active ? 'Usuário desativado' : 'Usuário ativado', description: u.active ? `${u.name} não consegue mais entrar no portal.` : u.name })
  }

  const confirmReset = async () => {
    if (!resetting) return
    const u = resetting
    setResetting(null)
    const password = await resetPassword(u.id)
    if (password) setTemporary({ name: u.name, email: u.email, password })
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Usuários</h1>
          <p className="mt-1 text-sm text-slate-500">Contas com acesso ao portal. Atendentes ativos recebem protocolos pela distribuição automática. Vendedores, coordenadores e pós-vendas são vinculados às equipes cadastradas em Administração › Equipes. Observadores ficam em Administração › Observadores.</p>
        </div>
        <button className="btn-primary" onClick={() => { setErrors({}); setEditing({ ...EMPTY }) }}><Plus className="h-4 w-4" /> Novo usuário</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50/70">
            <tr><th className="th">Usuário</th><th className="th">Perfil</th><th className="th">Equipe</th><th className="th">Cargo</th><th className="th">Em aberto</th><th className="th">Status</th><th className="th text-right">Ações</th></tr>
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
                <td className="td">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role]}`}>{ACCOUNT_ROLE_LABEL[u.role]}</span>
                  {u.isAdmin && <span className="ml-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Admin</span>}
                </td>
                <td className="td text-slate-600">{teamNames(u) || <span className="text-slate-400">—</span>}</td>
                <td className="td text-slate-600">{u.title}</td>
                <td className="td text-slate-600">{openCount(u)}</td>
                <td className="td"><ActiveBadge active={u.active} /></td>
                <td className="td">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => { setErrors({}); setEditing({ ...u }) }}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                    <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setResetting(u)}><KeyRound className="h-3.5 w-3.5" /> Redefinir senha</button>
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
                const role = e.target.value as Role
                setErrors({ ...errors, teamIds: undefined })
                setEditing({
                  ...editing, role, ...ROLE_DEFAULTS[role], isAdmin: role === 'agent' && editing.isAdmin,
                  teamIds: role === 'agent' ? [] : role === 'seller' ? editing.teamIds.slice(0, 1) : editing.teamIds,
                })
              }}>
                {(Object.keys(ROLE_DEFAULTS) as Role[]).map((r) => <option key={r} value={r}>{ACCOUNT_ROLE_LABEL[r]}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">{ROLE_HINT[editing.role]}</p>
            </FormField>
            <FormField label="Cargo" required error={errors.title} htmlFor="us-title">
              <input id="us-title" className={`input ${errors.title ? 'input-error' : ''}`} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </FormField>
            <FormField label="Departamento" htmlFor="us-dep">
              <input id="us-dep" className="input" value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value })} placeholder="Ex.: Comercial" />
            </FormField>
            <div><span className="label">Status</span><StatusSwitch checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} /></div>
            {editing.role === 'seller' && (
              <FormField label="Equipe" required error={errors.teamIds} className="sm:col-span-2" htmlFor="us-team">
                <select id="us-team" className={`input ${errors.teamIds ? 'input-error' : ''}`} value={editing.teamIds[0] ?? ''} onChange={(e) => { setErrors({ ...errors, teamIds: undefined }); setEditing({ ...editing, teamIds: e.target.value ? [e.target.value] : [] }) }}>
                  <option value="">Selecione a equipe</option>
                  {selectableTeams(editing).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </FormField>
            )}
            {(editing.role === 'coordinator' || editing.role === 'post_sales') && (
              <div className="sm:col-span-2">
                <span className="label">{editing.role === 'coordinator' ? 'Equipes que coordena' : 'Equipes que acompanha'} <span className="text-red-500">*</span></span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectableTeams(editing).map((t) => (
                    <label key={t.id} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 hover:border-slate-300">
                      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={editing.teamIds.includes(t.id)} onChange={() => { setErrors({ ...errors, teamIds: undefined }); toggleTeam(t.id) }} />
                      {t.name}{!t.active && <span className="text-xs text-slate-400">(inativa)</span>}
                    </label>
                  ))}
                </div>
                {errors.teamIds && <p className="mt-1.5 text-xs text-red-600">{errors.teamIds}</p>}
              </div>
            )}
            {editing.role === 'agent' && (
              <label className="flex items-start gap-2.5 text-[13px] text-slate-700 sm:col-span-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={editing.isAdmin} disabled={editing.id === currentUser.id} onChange={(e) => setEditing({ ...editing, isAdmin: e.target.checked })} />
                <span><b className="font-medium">Administrador do portal</b><span className="block text-xs text-slate-500">Gerencia categorias, observadores, usuários e configurações.</span></span>
              </label>
            )}
            {!editing.id && <p className="text-xs text-slate-500 sm:col-span-2">Ao salvar, o portal gera uma senha provisória para você repassar ao usuário.</p>}
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
