import type { ReactNode } from 'react'
import { asset } from '../utils/asset'

/** Moldura das telas de acesso (login e definição de senha). */
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="card relative overflow-hidden p-6 sm:p-7">
          <span className="absolute inset-x-0 top-0 h-1 bg-brand-600" />
          <img src={asset('logo-lar.png')} alt="Lar Plásticos" className="h-9 w-auto" />
          <p className="mt-4 text-[11px] font-semibold tracking-wider text-brand-700 uppercase">SAC · Central de Atendimento</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
