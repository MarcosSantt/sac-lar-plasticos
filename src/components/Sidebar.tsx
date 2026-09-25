import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export interface SidebarItem { to: string; label: string; icon: LucideIcon; description?: string }

export function Sidebar({ title, items }: { title: string; items: SidebarItem[] }) {
  return (
    <aside className="lg:w-60 lg:shrink-0">
      <div className="card p-2 lg:sticky lg:top-24">
        <p className="hidden px-3 pt-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 lg:block">{title}</p>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label={title}>
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <i.icon className="h-4 w-4" />
              {i.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}
