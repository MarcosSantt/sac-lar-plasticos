import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store/StoreContext'
import { MainLayout } from './layouts/MainLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { NewProtocolPage } from './pages/NewProtocolPage'
import { MyProtocolsPage } from './pages/MyProtocolsPage'
import { AllProtocolsPage } from './pages/AllProtocolsPage'
import { ProtocolRoute } from './pages/ProtocolPage'
import { FaqPage } from './pages/FaqPage'
import { WorkflowPage } from './pages/WorkflowPage'
import { SacDashboardPage } from './pages/SacDashboardPage'
import { CategoriesPage } from './pages/admin/CategoriesPage'
import { ObserversPage } from './pages/admin/ObserversPage'
import { UsersPage } from './pages/admin/UsersPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { TeamsPage } from './pages/admin/TeamsPage'
import { LookupsPage } from './pages/admin/LookupsPage'
import { ProductsPage } from './pages/admin/ProductsPage'
import { GoalsPage } from './pages/admin/GoalsPage'
import type { Persona } from './types'
import { canOpenProtocol, canSeePortfolio, isSacTeam } from './utils/access'

const isAdmin = (u: Persona) => u.isAdmin

/** Esconde telas restritas; o servidor valida a permissão de cada operação de qualquer forma. */
function Only({ when, children }: { when: (u: Persona) => boolean; children: ReactNode }) {
  const { currentUser } = useStore()
  return when(currentUser) ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="novo" element={<Only when={canOpenProtocol}><NewProtocolPage /></Only>} />
        <Route path="meus-protocolos" element={<MyProtocolsPage />} />
        <Route path="protocolos" element={<Only when={canSeePortfolio}><AllProtocolsPage /></Only>} />
        <Route path="protocolos/:number" element={<ProtocolRoute />} />
        <Route path="workflow" element={<Only when={isSacTeam}><WorkflowPage /></Only>} />
        <Route path="dashboard" element={<Only when={canSeePortfolio}><SacDashboardPage /></Only>} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="admin" element={<Only when={isAdmin}><AdminLayout /></Only>}>
          <Route index element={<Navigate to="categorias" replace />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="equipes" element={<TeamsPage />} />
          <Route path="listas" element={<LookupsPage />} />
          <Route path="produtos" element={<ProductsPage />} />
          <Route path="metas" element={<GoalsPage />} />
          <Route path="observadores" element={<ObserversPage />} />
          <Route path="usuarios" element={<UsersPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
