import { Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { NewProtocolPage } from './pages/NewProtocolPage'
import { MyProtocolsPage } from './pages/MyProtocolsPage'
import { AllProtocolsPage } from './pages/AllProtocolsPage'
import { ProtocolRoute } from './pages/ProtocolPage'
import { FaqPage } from './pages/FaqPage'
import { CategoriesPage } from './pages/admin/CategoriesPage'
import { ObserversPage } from './pages/admin/ObserversPage'
import { UsersPage } from './pages/admin/UsersPage'
import { SettingsPage } from './pages/admin/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="novo" element={<NewProtocolPage />} />
        <Route path="meus-protocolos" element={<MyProtocolsPage />} />
        <Route path="protocolos" element={<AllProtocolsPage />} />
        <Route path="protocolos/:number" element={<ProtocolRoute />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="categorias" replace />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="observadores" element={<ObserversPage />} />
          <Route path="usuarios" element={<UsersPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
