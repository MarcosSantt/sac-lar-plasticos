import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, MessageSquare } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { formatRelative } from '../utils/format'

export function NotificationCenter() {
  const { notifications, markNotificationRead, markAllNotificationsRead, protocols } = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/10 hover:text-white"
        aria-label={`Notificações (${unread} não lidas)`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span key={unread} className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] animate-pop-in items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-brand-deep">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 animate-pop-in overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/10 sm:absolute sm:inset-x-auto sm:top-11 sm:right-0 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-900">Notificações</p>
              <p className="text-xs text-slate-500">{unread ? `${unread} não lida(s)` : 'Tudo em dia'}</p>
            </div>
            {unread > 0 && (
              <button onClick={markAllNotificationsRead} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
                <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma notificação por aqui.</li>}
            {notifications.map((n) => {
              const exists = protocols.some((p) => p.protocolNumber === n.protocolNumber)
              return (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      markNotificationRead(n.id)
                      setOpen(false)
                      if (exists) navigate(`/protocolos/${n.protocolNumber}`)
                    }}
                    className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/50'}`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.read ? 'bg-slate-100 text-slate-400' : 'bg-brand-100 text-brand-600'}`}>
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-slate-900">{n.title}</span>
                      <span className="block text-[13px] text-slate-600">{n.body}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{formatRelative(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
