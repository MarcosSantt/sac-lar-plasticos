import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Header } from '../components/Header'
import { asset } from '../utils/asset'

export function MainLayout() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo({ top: 0 }), [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 lg:px-6 lg:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row lg:px-6">
          <span className="flex items-center gap-2.5">
            <img src={asset('logo-lar.png')} alt="Lar Plásticos" className="h-5 w-auto" />
            <span className="text-slate-300">|</span>
            <span>SAC · Central de Atendimento</span>
          </span>
          <span className="text-slate-400">Ambiente de demonstração · dados armazenados localmente no navegador</span>
        </div>
      </footer>
    </div>
  )
}
