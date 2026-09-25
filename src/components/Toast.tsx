import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Info, X } from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info' | 'notification'

interface ToastItem {
  id: number
  title: string
  description?: string
  variant: ToastVariant
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  toast: (t: Omit<ToastItem, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-brand-600" />,
  error: <AlertTriangle className="h-5 w-5 text-red-600" />,
  info: <Info className="h-5 w-5 text-brand-600" />,
  notification: <Bell className="h-5 w-5 text-brand-600" />,
}

const ACCENT = {
  success: 'border-l-brand-500',
  error: 'border-l-red-500',
  info: 'border-l-brand-500',
  notification: 'border-l-brand-500',
}

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setItems((s) => s.filter((t) => t.id !== id)), [])

  const toast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++seq
    setItems((s) => [...s.slice(-3), { ...t, id }])
    window.setTimeout(() => dismiss(id), t.variant === 'notification' ? 6000 : 4500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:top-20 sm:bottom-auto">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex animate-toast-in gap-3 rounded-lg border border-l-4 border-slate-200 bg-white p-3.5 shadow-lg shadow-slate-900/10 ${ACCENT[t.variant]}`}
          >
            <div className="mt-0.5 shrink-0">{ICONS[t.variant]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[13px] text-slate-600">{t.description}</p>}
              {t.action && (
                <button
                  className="mt-1.5 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                  onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="h-6 w-6 shrink-0 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar">
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx.toast
}
