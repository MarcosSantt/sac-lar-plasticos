import { useState } from 'react'
import { Pencil, Plus, Power, Users } from 'lucide-react'
import type { Team } from '../../types'
import { useStore } from '../../store/StoreContext'
import { normalize } from '../../utils/format'
import { Modal } from '../../components/Modal'
import { FormField } from '../../components/FormField'
import { ActiveBadge, StatusSwitch } from '../../components/ActiveToggle'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'

const EMPTY: Team = { id: '', name: '', active: true }

export function TeamsPage() {
  const { teams, users, protocols, saveTeam } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<Team | null>(null)
  const [error, setError] = useState('')

  const members = (id: string, role: 'seller' | 'coordinator' | 'post_sales') =>
    users.filter((u) => u.active && u.role === role && u.teamIds.includes(id))
  const names = (list: { name: string }[]) => (list.length ? list.map((u) => u.name).join(', ') : <span className="text-slate-400">—</span>)

  const save = async () => {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) return setError('Informe o nome da equipe.')
    if (teams.some((t) => t.id !== editing.id && normalize(t.name) === normalize(name))) return setError('Já existe uma equipe com este nome.')
    const isNew = !editing.id
    if (!(await saveTeam({ ...editing, name }))) return
    toast({ variant: 'success', title: isNew ? 'Equipe criada' : 'Equipe atualizada', description: isNew ? `Vincule vendedores e coordenadores a "${name}" em Administração › Usuários.` : `As alterações em "${name}" foram salvas.` })
    setEditing(null)
  }

  const toggle = async (t: Team) => {
    if (!(await saveTeam({ ...t, active: !t.active }))) return
    toast({ variant: 'success', title: t.active ? 'Equipe desativada' : 'Equipe ativada', description: t.active ? `"${t.name}" não aparece mais para novos vínculos e aberturas.` : t.name })
  }

  const open = (t: Team) => { setError(''); setEditing({ ...t }) }

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Equipes</h1>
          <p className="mt-1 text-sm text-slate-500">Carteiras comerciais. Cada protocolo pertence à equipe de quem o abriu, e o coordenador e o pós-vendas veem apenas as equipes a que estão vinculados. Os vínculos são feitos em Administração › Usuários.</p>
        </div>
        <button className="btn-primary" onClick={() => open(EMPTY)}><Plus className="h-4 w-4" /> Nova equipe</button>
      </div>

      <div className="card overflow-hidden">
        {teams.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50/70">
                <tr><th className="th">Equipe</th><th className="th">Coordenação</th><th className="th">Pós-vendas</th><th className="th">Vendedores</th><th className="th">Protocolos</th><th className="th">Status</th><th className="th text-right">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teams.map((t) => (
                  <tr key={t.id} className={`hover:bg-brand-50/70 ${t.active ? '' : 'opacity-70'}`}>
                    <td className="td font-medium text-slate-900">{t.name}</td>
                    <td className="td max-w-56 text-slate-600">{names(members(t.id, 'coordinator'))}</td>
                    <td className="td max-w-56 text-slate-600">{names(members(t.id, 'post_sales'))}</td>
                    <td className="td text-slate-600">{members(t.id, 'seller').length}</td>
                    <td className="td text-slate-600">{protocols.filter((p) => p.teamId === t.id).length}</td>
                    <td className="td"><ActiveBadge active={t.active} labels={['Ativa', 'Inativa']} /></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => open(t)}><Pencil className="h-3.5 w-3.5" /> Editar</button>
                        <button className={`btn-ghost px-2.5 py-1.5 text-xs ${t.active ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-brand-50 hover:text-brand-700'}`} onClick={() => toggle(t)}>
                          <Power className="h-3.5 w-3.5" /> {t.active ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={<Users className="h-6 w-6" />} title="Nenhuma equipe cadastrada" />}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Editar equipe' : 'Nova equipe'}
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar equipe</button></>}
      >
        {editing && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }}>
            <FormField label="Nome da equipe" required error={error} htmlFor="team-name">
              <input id="team-name" autoFocus className={`input ${error ? 'input-error' : ''}`} value={editing.name} onChange={(e) => { setError(''); setEditing({ ...editing, name: e.target.value }) }} placeholder="Ex.: Equipe 3" />
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
