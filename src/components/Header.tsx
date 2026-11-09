import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, ChevronDown, FilePlus2, HelpCircle, Inbox, KeyRound, LayoutDashboard, ListFilter, LogOut, Menu, Settings, Workflow, X,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Avatar } from './Avatar'
import { NotificationCenter } from './NotificationCenter'
import { Modal } from './Modal'
import { PasswordForm } from './PasswordForm'
import { useToast } from './Toast'
import { asset } from '../utils/asset'
import { canOpenProtocol, canSeePortfolio, isSacTeam } from '../utils/access'
import type { Persona } from '../types'

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; only?: (u: Persona) => boolean }[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/novo', label: 'Abrir SAC', icon: FilePlus2, only: canOpenProtocol },
  { to: '/meus-protocolos', label: 'Meus Protocolos', icon: Inbox, only: (u) => u.role !== 'coordinator' },
  { to: '/protocolos', label: 'Todos os Protocolos', icon: ListFilter, end: true, only: canSeePortfolio },
  { to: '/workflow', label: 'Workflow', icon: Workflow, only: isSacTeam },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3, only: canSeePortfolio },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
  { to: '/admin', label: 'Administração', icon: Settings, only: (u) => u.isAdmin },
]

export function Header() {
  const { currentUser, settings, changePassword, logout } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => setMobileNav(false), [location.pathname])
  useEffect(() => {
    const onClick = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenuOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const isProtocolDetail = location.pathname.startsWith('/protocolos/')
  const nav = NAV.filter((n) => !n.only || n.only(currentUser))
  // A tela de um protocolo destaca a lista de onde a pessoa normalmente chega até ela.
  const detailParent = canSeePortfolio(currentUser) ? '/protocolos' : '/meus-protocolos'

  const savePassword = async (current: string, next: string) => {
    const done = await changePassword(current, next)
    if (done) {
      setPasswordOpen(false)
      toast({ variant: 'success', title: 'Senha alterada', description: 'Use a nova senha no próximo acesso.' })
    }
    return done
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors xl:px-3 ${
      isActive
        ? 'bg-white/12 text-white after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-[3px] after:rounded-t-full after:bg-brand-accent'
        : 'text-white/75 hover:bg-white/8 hover:text-white'
    }`

  return (
    <header className="sticky top-0 z-40 bg-brand-deep text-white shadow-[0_4px_14px_var(--shadow-strong)]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 lg:px-6">
        <button className="rounded-md p-2 text-white/85 hover:bg-white/10 lg:hidden" onClick={() => setMobileNav((v) => !v)} aria-label="Abrir menu">
          {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <NavLink to="/" className="mr-2 flex shrink-0 items-center gap-3 xl:mr-4" aria-label={`${settings.companyName} — SAC, página inicial`}>
          <span className="flex h-11 items-center rounded-lg bg-white px-3 shadow-sm">
            <img src={asset('logo-lar.png')} alt="Lar Plásticos" className="h-8 w-auto" />
          </span>
          <span className="hidden border-l border-white/20 pl-3 leading-tight sm:block lg:hidden min-[1400px]:block">
            <span className="block text-[13px] font-semibold tracking-wide">SAC</span>
            <span className="block text-[11px] text-white/60">Central de Atendimento</span>
          </span>
        </NavLink>

        <nav className="hidden flex-1 items-center gap-0.5 lg:flex" aria-label="Menu principal">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={(s) => linkClass({ isActive: s.isActive || (n.to === detailParent && isProtocolDetail) })}
            >
              <n.icon className="hidden h-4 w-4 opacity-80 xl:block" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <NotificationCenter />
          <div className="mx-1 hidden h-7 w-px bg-white/15 sm:block" />
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 transition hover:bg-white/10">
              <Avatar name={currentUser.name} size="sm" ring />
              <span className="hidden text-left leading-tight md:block">
                <span className="block text-[13px] font-medium">{currentUser.name}</span>
                <span className="block text-[11px] text-white/60">{currentUser.subtitle}</span>
              </span>
              <ChevronDown className={`hidden h-4 w-4 text-white/60 transition-transform md:block ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute top-12 right-0 z-50 w-72 animate-pop-in overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/10">
                <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                  <Avatar name={currentUser.name} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{currentUser.name}</p>
                    <p className="truncate text-xs text-slate-500">{currentUser.email}</p>
                  </div>
                </div>
                <div className="border-t border-slate-200 py-1.5">
                  {currentUser.isAdmin && (
                    <button onClick={() => { setMenuOpen(false); navigate('/admin/configuracoes') }} className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                      <Settings className="h-4 w-4 text-slate-400" /> Configurações
                    </button>
                  )}
                  <button onClick={() => { setMenuOpen(false); setPasswordOpen(true) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                    <KeyRound className="h-4 w-4 text-slate-400" /> Alterar senha
                  </button>
                  <button onClick={() => { setMenuOpen(false); logout() }} className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                    <LogOut className="h-4 w-4 text-slate-400" /> Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileNav && (
        <nav className="animate-fade-in border-t border-white/10 bg-brand-deep px-3 pb-3 lg:hidden" aria-label="Menu principal">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `mt-1 flex items-center gap-2.5 rounded-md border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'border-brand-accent bg-white/12 text-white' : 'border-transparent text-white/75 hover:bg-white/8 hover:text-white'}`}>
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
      )}

      <Modal open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Alterar senha" size="sm">
        {passwordOpen && (
          <PasswordForm
            submitLabel="Alterar senha"
            onSubmit={savePassword}
            secondary={<button type="button" className="btn-secondary" onClick={() => setPasswordOpen(false)}>Cancelar</button>}
          />
        )}
      </Modal>
    </header>
  )
}
