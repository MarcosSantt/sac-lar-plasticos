import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown, FilePlus2, HelpCircle, Inbox, LayoutDashboard, ListFilter, LogOut, Menu, Repeat, Settings, X,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { Avatar } from './Avatar'
import { NotificationCenter } from './NotificationCenter'
import { useToast } from './Toast'
import { asset } from '../utils/asset'

const NAV = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/novo', label: 'Abrir SAC', icon: FilePlus2 },
  { to: '/meus-protocolos', label: 'Meus Protocolos', icon: Inbox },
  { to: '/protocolos', label: 'Todos os Protocolos', icon: ListFilter, end: true },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
  { to: '/admin', label: 'Administração', icon: Settings },
]

const ROLE_GROUPS = [
  { role: 'requester', label: 'Solicitantes' },
  { role: 'agent', label: 'Equipe SAC' },
  { role: 'observer', label: 'Observadores' },
] as const

export function Header() {
  const { currentUser, personas, setCurrentUser, settings } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
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
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={(s) => linkClass({ isActive: s.isActive || (n.to === '/protocolos' && isProtocolDetail) })}
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
                <div className="max-h-80 overflow-y-auto py-1.5">
                  <p className="flex items-center gap-1.5 px-4 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <Repeat className="h-3 w-3" /> Alternar perfil (demonstração)
                  </p>
                  {ROLE_GROUPS.map((g) => {
                    const list = personas.filter((p) => p.role === g.role)
                    if (!list.length) return null
                    return (
                      <div key={g.role}>
                        <p className="px-4 pt-2 pb-1 text-[11px] font-medium text-slate-500">{g.label}</p>
                        {list.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setCurrentUser(p.id)
                              setMenuOpen(false)
                              toast({ variant: 'info', title: `Você está como ${p.name}`, description: p.subtitle })
                            }}
                            className={`flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-[13px] transition hover:bg-slate-50 ${p.id === currentUser.id ? 'bg-brand-50/60' : ''}`}
                          >
                            <Avatar name={p.name} size="xs" />
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            {p.id === currentUser.id && <span className="h-2 w-2 rounded-full bg-brand-500" />}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-slate-200 py-1.5">
                  <button onClick={() => { setMenuOpen(false); navigate('/admin/configuracoes') }} className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                    <Settings className="h-4 w-4 text-slate-400" /> Configurações
                  </button>
                  <button onClick={() => { setMenuOpen(false); toast({ variant: 'info', title: 'Sessão de demonstração', description: 'Nesta demo o login é simulado. Use "Alternar perfil" para mudar de usuário.' }) }} className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
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
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `mt-1 flex items-center gap-2.5 rounded-md border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'border-brand-accent bg-white/12 text-white' : 'border-transparent text-white/75 hover:bg-white/8 hover:text-white'}`}>
              <n.icon className="h-4 w-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
