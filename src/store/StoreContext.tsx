import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  AccountRole, Category, ItemCosts, Lookup, MonthProduction, Notification, Observer, Persona, Priority, Product, Protocol,
  ProtocolStatus, RequestType, Requester, SaleType, Settings, Team, User, YearGoals,
} from '../types'
import { ACCOUNT_ROLE_LABEL } from '../utils/access'
import { ApiError, api, setUnauthenticatedHandler } from '../api/client'
import { useToast } from '../components/Toast'
import { LoginPage } from '../pages/LoginPage'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'
import { SplashScreen } from '../components/SplashScreen'

/** Intervalo de atualização automática dos dados enquanto a aba está visível. */
const REFRESH_MS = 20_000

interface Me {
  id: string
  name: string
  email: string
  phone: string
  department: string
  title: string
  role: AccountRole
  isAdmin: boolean
  mustChangePassword: boolean
  teamIds: string[]
}

interface Data {
  protocols: Protocol[]
  categories: Category[]
  teams: Team[]
  lookups: Lookup[]
  goals: YearGoals[]
  production: MonthProduction[]
  observers: Observer[]
  users: User[]
  notifications: Notification[]
  settings: Settings
}

export interface NewProtocolInput {
  requester: Requester
  type: RequestType
  categoryId: string
  title: string
  priority: Priority
  location: string
  description: string
  observerIds: string[]
  /** Equipe escolhida pelo pós-vendas; o vendedor usa sempre a própria. */
  teamId?: string
  customerName: string
  invoiceNumber: string
  invoiceDate: string | null
  orderNumber: string
  saleType: SaleType
  items: { productCode: string; quantity: number; description: string }[]
}

/** Dados comerciais e de logística editados pela equipe SAC. */
export interface DetailsInput {
  customerName: string
  invoiceNumber: string
  invoiceDate: string | null
  orderNumber: string
  saleType: SaleType
  unit: string
  returnMethod: string
  returnInvoice: string
}

export interface ItemInput {
  productCode: string
  quantity: number
  description: string
  location: string
  failureMode: string
  responsibleArea: string
  machinery: string
  treatment: string
  commercialConcession: boolean
  costs: ItemCosts
}

export interface GoalsInput extends Omit<YearGoals, 'year'> {
  /** kg de cada mês; nulo = não lançado. */
  production: (number | null)[]
}

/** Dados de cadastro de uma conta (inclusive observadores). */
export interface AccountInput {
  id: string
  name: string
  email: string
  phone?: string
  department: string
  title?: string
  role: AccountRole
  isAdmin?: boolean
  active: boolean
  teamIds?: string[]
}

/** Resultado de um cadastro: a senha provisória só existe quando a conta acabou de ser criada. */
export interface AccountResult { temporaryPassword?: string }

interface StoreValue extends Data {
  currentUser: Persona
  getCategoryName: (id: string) => string
  getUser: (id: string | null) => User | undefined
  getObserver: (id: string) => Observer | undefined
  createProtocol: (input: NewProtocolInput, files: File[]) => Promise<Protocol | null>
  sendMessage: (protocolId: string, content: string, files: File[]) => Promise<boolean>
  changeStatus: (protocolId: string, status: ProtocolStatus) => Promise<boolean>
  assignResponsible: (protocolId: string, userId: string) => Promise<boolean>
  addObservers: (protocolId: string, ids: string[]) => Promise<boolean>
  removeObserver: (protocolId: string, id: string) => Promise<boolean>
  addAttachments: (protocolId: string, files: File[]) => Promise<boolean>
  saveCategory: (c: Category) => Promise<boolean>
  saveTeam: (t: Team) => Promise<boolean>
  updateDetails: (protocolId: string, d: DetailsInput) => Promise<boolean>
  saveItem: (protocolId: string, itemId: string | null, item: ItemInput) => Promise<boolean>
  removeItem: (protocolId: string, itemId: string) => Promise<boolean>
  searchProducts: (q: string) => Promise<Product[]>
  saveLookup: (l: Lookup) => Promise<boolean>
  saveProduct: (p: Product, isNew: boolean) => Promise<boolean>
  saveGoals: (year: number, g: GoalsInput) => Promise<boolean>
  saveAccount: (a: AccountInput) => Promise<AccountResult | null>
  resetPassword: (userId: string) => Promise<string | null>
  updateSettings: (s: Settings) => Promise<boolean>
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>
  logout: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

function filesForm(files: File[], fields: Record<string, string> = {}) {
  const form = new FormData()
  // Os campos vão antes dos arquivos para o servidor validá-los primeiro.
  Object.entries(fields).forEach(([k, v]) => form.set(k, v))
  files.forEach((f) => form.append('files', f, f.name))
  return form
}

type Session = { phase: 'loading' } | { phase: 'anonymous' } | { phase: 'signed'; me: Me }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ phase: 'loading' })
  const [data, setData] = useState<Data | null>(null)
  const toast = useToast()
  // Incrementado a cada alteração local: uma atualização automática iniciada antes dela é descartada.
  const revision = useRef(0)
  const knownNotifications = useRef<Set<string> | null>(null)

  const signOut = useCallback(() => {
    setSession({ phase: 'anonymous' })
    setData(null)
    knownNotifications.current = null
  }, [])

  const fail = useCallback((err: unknown, title = 'Não foi possível concluir') => {
    // Sessão expirada: a tela de login já explica o que houve.
    if (err instanceof ApiError && err.code === 'UNAUTHENTICATED') return
    toast({ variant: 'error', title, description: err instanceof Error ? err.message : undefined })
  }, [toast])

  const refresh = useCallback(async () => {
    const started = revision.current
    const fresh = await api.get<Data>('/bootstrap')
    if (started !== revision.current) return
    setData(fresh)

    const known = knownNotifications.current
    knownNotifications.current = new Set(fresh.notifications.map((n) => n.id))
    if (!known) return
    fresh.notifications.filter((n) => !n.read && !known.has(n.id)).slice(0, 3)
      .forEach((n) => toast({ variant: 'notification', title: n.title, description: n.body }))
  }, [toast])

  // Sessão inicial: reaproveita o login se o cookie ainda for válido.
  useEffect(() => {
    setUnauthenticatedHandler(signOut)
    api.get<{ user: Me }>('/auth/me')
      .then(({ user }) => setSession({ phase: 'signed', me: user }))
      .catch(() => setSession({ phase: 'anonymous' }))
  }, [signOut])

  const ready = session.phase === 'signed' && !session.me.mustChangePassword
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const load = () => refresh().then(() => setLoadError(false)).catch(() => { if (!cancelled) setLoadError(true) })
    load()
    const tick = () => { if (document.visibilityState === 'visible') load() }
    const timer = window.setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [ready, refresh])

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api.post<{ user: Me }>('/auth/login', { email, password })
    setSession({ phase: 'signed', me: user })
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {})
    signOut()
  }, [signOut])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const { user } = await api.post<{ user: Me }>('/auth/change-password', { currentPassword, newPassword })
      setSession({ phase: 'signed', me: user })
      return true
    } catch (err) {
      fail(err, 'Senha não alterada')
      return false
    }
  }, [fail])

  /** Envia uma alteração de protocolo e aplica o resultado na tela. */
  const mutateProtocol = useCallback(async (send: () => Promise<{ protocol: Protocol | null }>, removedId?: string): Promise<Protocol | null | false> => {
    try {
      const { protocol } = await send()
      revision.current++
      setData((d) => {
        if (!d) return d
        if (!protocol) return { ...d, protocols: d.protocols.filter((p) => p.id !== removedId) }
        const exists = d.protocols.some((p) => p.id === protocol.id)
        return { ...d, protocols: exists ? d.protocols.map((p) => (p.id === protocol.id ? protocol : p)) : [protocol, ...d.protocols] }
      })
      return protocol
    } catch (err) {
      fail(err)
      return false
    }
  }, [fail])

  /** Envia uma alteração administrativa e recarrega os cadastros. */
  const mutateAdmin = useCallback(async <T,>(send: () => Promise<T>): Promise<T | null> => {
    try {
      const result = await send()
      revision.current++
      await refresh().catch(() => {})
      return result
    } catch (err) {
      fail(err)
      return null
    }
  }, [fail, refresh])

  const currentUser = useMemo<Persona | null>(() => {
    if (session.phase !== 'signed') return null
    const { me } = session
    return { id: me.id, name: me.name, email: me.email, phone: me.phone, role: me.role, isAdmin: me.isAdmin, teamIds: me.teamIds, subtitle: me.title || ACCOUNT_ROLE_LABEL[me.role] }
  }, [session])

  if (session.phase === 'loading') return <SplashScreen />
  if (session.phase === 'anonymous' || !currentUser) return <LoginPage onLogin={login} />
  if (session.me.mustChangePassword) return <ChangePasswordPage name={session.me.name} onSubmit={changePassword} onLogout={logout} />
  if (!data) return <SplashScreen error={loadError ? 'Não foi possível carregar os dados do portal.' : undefined} onRetry={() => { setLoadError(false); refresh().catch(() => setLoadError(true)) }} />

  const ok = async (send: () => Promise<{ protocol: Protocol | null }>, removedId?: string) => (await mutateProtocol(send, removedId)) !== false

  const markRead = (id?: string) => {
    revision.current++
    setData((d) => d && { ...d, notifications: d.notifications.map((n) => (!id || n.id === id ? { ...n, read: true } : n)) })
    api.post('/notifications/read', id ? { id } : {}).catch(() => {})
  }

  const value: StoreValue = {
    ...data,
    currentUser,
    getCategoryName: (id) => data.categories.find((c) => c.id === id)?.name ?? 'Sem categoria',
    getUser: (id) => data.users.find((u) => u.id === id),
    getObserver: (id) => data.observers.find((o) => o.id === id),
    createProtocol: async (input, files) =>
      (await mutateProtocol(() => api.post('/protocols', filesForm(files, { data: JSON.stringify(input) })))) || null,
    sendMessage: (protocolId, content, files) => ok(() => api.post(`/protocols/${protocolId}/messages`, filesForm(files, { content }))),
    changeStatus: (protocolId, status) => ok(() => api.patch(`/protocols/${protocolId}`, { status })),
    assignResponsible: (protocolId, userId) => ok(() => api.patch(`/protocols/${protocolId}`, { responsibleId: userId })),
    addObservers: (protocolId, ids) => ok(() => api.post(`/protocols/${protocolId}/observers`, { ids })),
    removeObserver: (protocolId, id) => ok(() => api.delete(`/protocols/${protocolId}/observers/${id}`), protocolId),
    addAttachments: (protocolId, files) => ok(() => api.post(`/protocols/${protocolId}/attachments`, filesForm(files))),
    saveCategory: async ({ id, ...body }) =>
      (await mutateAdmin(() => (id ? api.patch(`/admin/categories/${id}`, body) : api.post('/admin/categories', body)))) !== null,
    saveTeam: async ({ id, ...body }) =>
      (await mutateAdmin(() => (id ? api.patch(`/admin/teams/${id}`, body) : api.post('/admin/teams', body)))) !== null,
    updateDetails: (protocolId, d) => ok(() => api.patch(`/protocols/${protocolId}/details`, d)),
    saveItem: (protocolId, itemId, item) =>
      ok(() => (itemId ? api.put(`/protocols/${protocolId}/items/${itemId}`, item) : api.post(`/protocols/${protocolId}/items`, item))),
    removeItem: (protocolId, itemId) => ok(() => api.delete(`/protocols/${protocolId}/items/${itemId}`)),
    searchProducts: async (q) => (await api.get<{ products: Product[] }>(`/products?q=${encodeURIComponent(q)}`)).products,
    saveLookup: async ({ id, kind, ...body }) =>
      (await mutateAdmin(() => (id ? api.patch(`/admin/lookups/${id}`, body) : api.post('/admin/lookups', { kind, ...body })))) !== null,
    saveProduct: async ({ code, ...body }, isNew) =>
      (await mutateAdmin(() => (isNew ? api.post('/admin/products', { code, ...body }) : api.patch(`/admin/products/${encodeURIComponent(code)}`, body)))) !== null,
    saveGoals: async (year, g) => (await mutateAdmin(() => api.put(`/admin/goals/${year}`, g))) !== null,
    saveAccount: ({ id, ...body }) =>
      mutateAdmin(() => (id ? api.patch<AccountResult>(`/admin/users/${id}`, body) : api.post<AccountResult>('/admin/users', body))),
    resetPassword: async (userId) =>
      (await mutateAdmin(() => api.post<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`)))?.temporaryPassword ?? null,
    updateSettings: async (s) => (await mutateAdmin(() => api.patch('/admin/settings', s))) !== null,
    markNotificationRead: (id) => markRead(id),
    markAllNotificationsRead: () => markRead(),
    changePassword,
    logout,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore deve ser usado dentro de StoreProvider')
  return ctx
}
