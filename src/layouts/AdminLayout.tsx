import { Outlet } from 'react-router-dom'
import { Settings, Tags, UserCog, Eye } from 'lucide-react'
import { Sidebar } from '../components/Sidebar'

const ITEMS = [
  { to: '/admin/categorias', label: 'Categorias', icon: Tags },
  { to: '/admin/observadores', label: 'Observadores', icon: Eye },
  { to: '/admin/usuarios', label: 'Usuários', icon: UserCog },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
]

export function AdminLayout() {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
      <Sidebar title="Administração" items={ITEMS} />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
