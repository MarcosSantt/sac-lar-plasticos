import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  Attachment, Author, Category, HistoryEvent, HistoryKind, Notification, Observer, Persona, Priority,
  Protocol, ProtocolStatus, RequestType, Requester, Settings, User,
} from '../types'
import {
  buildSeedNotifications, buildSeedProtocols, seedCategories, seedObservers, seedSettings, seedUsers,
} from '../data/seed'
import { uid } from '../utils/format'
import { OPEN_STATUSES, STATUS_META } from '../utils/protocol'
import { useToast } from '../components/Toast'

const STORAGE_KEY = 'larplasticos-sac:v2'

interface State {
  protocols: Protocol[]
  categories: Category[]
  observers: Observer[]
  users: User[]
  notifications: Notification[]
  settings: Settings
  currentUserId: string
}

function createInitialState(): State {
  const protocols = buildSeedProtocols()
  return {
    protocols,
    categories: seedCategories,
    observers: seedObservers,
    users: seedUsers,
    notifications: buildSeedNotifications(protocols),
    settings: seedSettings,
    currentUserId: 'u_marcos',
  }
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...createInitialState(), ...JSON.parse(raw) }
  } catch { /* dados corrompidos: recria a base da demo */ }
  return createInitialState()
}

function persist(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota excedida: remove as pré-visualizações de imagens e tenta novamente.
    const strip = (a: Attachment) => ({ ...a, dataUrl: undefined })
    const light: State = {
      ...state,
      protocols: state.protocols.map((p) => ({
        ...p,
        attachments: p.attachments.map(strip),
        messages: p.messages.map((m) => ({ ...m, attachments: m.attachments.map(strip) })),
      })),
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(light)) } catch { /* sem armazenamento disponível */ }
  }
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
  attachments: Attachment[]
}

interface StoreValue extends State {
  currentUser: Persona
  personas: Persona[]
  setCurrentUser: (id: string) => void
  getCategoryName: (id: string) => string
  getUser: (id: string | null) => User | undefined
  getObserver: (id: string) => Observer | undefined
  createProtocol: (input: NewProtocolInput) => Protocol
  sendMessage: (protocolId: string, author: Author, content: string, attachments: Attachment[], simulateMinutes?: number) => void
  changeStatus: (protocolId: string, status: ProtocolStatus) => void
  assignResponsible: (protocolId: string, userId: string) => void
  addObservers: (protocolId: string, ids: string[]) => void
  removeObserver: (protocolId: string, id: string) => void
  addAttachments: (protocolId: string, attachments: Attachment[]) => void
  saveCategory: (c: Category) => void
  saveObserver: (o: Observer) => void
  saveUser: (u: User) => void
  updateSettings: (s: Partial<Settings>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  resetDemo: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

const event = (kind: HistoryKind, description: string, actor: string, createdAt: string): HistoryEvent => ({
  id: uid('h'), kind, description, actor, createdAt,
})

const ROLE_LABEL = { requester: 'Solicitante', agent: 'Atendente', observer: 'Observador' }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(loadState)
  const toast = useToast()

  useEffect(() => { persist(state) }, [state])

  const personas = useMemo<Persona[]>(() => [
    ...state.users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, subtitle: u.title })),
    ...state.observers.filter((o) => o.active).map((o) => ({ id: o.id, name: o.name, email: o.email, role: 'observer' as const, subtitle: `Observador · ${o.department}` })),
  ], [state.users, state.observers])

  const currentUser = useMemo<Persona>(
    () => personas.find((p) => p.id === state.currentUserId) ?? personas[0],
    [personas, state.currentUserId],
  )

  const updateProtocol = useCallback((id: string, fn: (p: Protocol) => Protocol) => {
    setState((s) => ({ ...s, protocols: s.protocols.map((p) => (p.id === id ? fn(p) : p)) }))
  }, [])

  const notify = useCallback((n: Omit<Notification, 'id' | 'read' | 'createdAt'>, createdAt = new Date().toISOString()) => {
    setState((s) => ({ ...s, notifications: [{ ...n, id: uid('n'), read: false, createdAt }, ...s.notifications].slice(0, 40) }))
    toast({ variant: 'notification', title: n.title, description: n.body })
  }, [toast])

  const createProtocol = useCallback((input: NewProtocolInput): Protocol => {
    const now = new Date().toISOString()
    const year = new Date().getFullYear()
    const { settings, users, protocols, observers } = state
    const number = `${settings.protocolPrefix}-${year}-${String(settings.nextSequence).padStart(5, '0')}`

    // Distribuição automática: atendente ativo com menos protocolos em aberto.
    const agents = users.filter((u) => u.role === 'agent' && u.active)
    const load = (id: string) => protocols.filter((p) => p.responsibleId === id && OPEN_STATUSES.includes(p.status)).length
    const responsible = settings.autoAssign && agents.length
      ? [...agents].sort((a, b) => load(a.id) - load(b.id))[0]
      : null

    const history: HistoryEvent[] = [event('created', 'Protocolo criado', input.requester.name, now)]
    if (responsible) history.push(event('assigned', `Atribuído automaticamente a ${responsible.name}`, 'Sistema', now))
    input.observerIds.forEach((id) => {
      const o = observers.find((x) => x.id === id)
      if (o) history.push(event('observer_added', `Observador ${o.name} adicionado`, input.requester.name, now))
    })
    if (input.attachments.length) {
      history.push(event('attachment', `${input.attachments.length} anexo(s) adicionado(s): ${input.attachments.map((a) => a.name).join(', ')}`, input.requester.name, now))
    }

    const protocol: Protocol = {
      id: uid('p'),
      protocolNumber: number,
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type,
      categoryId: input.categoryId,
      priority: input.priority,
      status: 'novo',
      location: input.location.trim(),
      requester: input.requester,
      responsibleId: responsible?.id ?? null,
      observerIds: input.observerIds,
      attachments: input.attachments,
      messages: [{
        id: uid('m'),
        author: { id: 'requester', name: input.requester.name, role: 'requester' },
        content: input.description.trim(),
        attachments: input.attachments,
        createdAt: now,
        responseTime: null,
      }],
      history,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    }

    setState((s) => ({
      ...s,
      protocols: [protocol, ...s.protocols],
      settings: { ...s.settings, nextSequence: s.settings.nextSequence + 1 },
    }))
    return protocol
  }, [state])

  const sendMessage = useCallback<StoreValue['sendMessage']>((protocolId, author, content, attachments, simulateMinutes = 0) => {
    const p = state.protocols.find((x) => x.id === protocolId)
    if (!p) return
    const last = p.messages[p.messages.length - 1]
    const lastTime = new Date(last?.createdAt ?? p.createdAt).getTime()
    const time = simulateMinutes > 0 ? lastTime + simulateMinutes * 60000 : Math.max(Date.now(), lastTime)
    const createdAt = new Date(time).toISOString()
    const responseTime = (time - lastTime) / 60000

    const history: HistoryEvent[] = []
    if (content.trim()) {
      history.push(event('message', `${ROLE_LABEL[author.role]} ${author.name} enviou mensagem`, author.name, createdAt))
    }
    if (attachments.length) {
      history.push(event('attachment', `${attachments.length} anexo(s) adicionado(s): ${attachments.map((a) => a.name).join(', ')}`, author.name, createdAt))
    }

    // Transições automáticas de status, como em uma ferramenta de SAC real.
    let status = p.status
    if (author.role === 'agent' && p.status === 'novo') status = 'em_atendimento'
    if (author.role === 'requester' && p.status === 'aguardando_cliente') status = 'em_atendimento'
    if (status !== p.status) {
      history.push(event('status', `Status alterado automaticamente de ${STATUS_META[p.status].label} para ${STATUS_META[status].label}`, 'Sistema', createdAt))
    }

    updateProtocol(protocolId, (cur) => ({
      ...cur,
      status,
      messages: [...cur.messages, { id: uid('m'), author, content: content.trim(), attachments, createdAt, responseTime }],
      attachments: [...cur.attachments, ...attachments],
      history: [...cur.history, ...history],
      updatedAt: createdAt,
    }))

    if (author.id !== state.currentUserId) {
      notify({
        title: `Novo comentário no protocolo ${p.protocolNumber}`,
        body: `${author.name} respondeu ao protocolo.`,
        protocolNumber: p.protocolNumber,
      }, createdAt)
    }
  }, [state.protocols, state.currentUserId, updateProtocol, notify])

  const actorName = () => personas.find((x) => x.id === state.currentUserId)?.name ?? 'Usuário'

  const changeStatus = (protocolId: string, status: ProtocolStatus) => {
    updateProtocol(protocolId, (p) => {
      if (p.status === status) return p
      const closing = status === 'resolvido' || status === 'fechado'
      const updatedAt = new Date(Math.max(Date.now(), new Date(p.updatedAt).getTime())).toISOString()
      return {
        ...p,
        status,
        closedAt: closing ? (p.closedAt ?? updatedAt) : null,
        updatedAt,
        history: [...p.history, event('status', `Status alterado de ${STATUS_META[p.status].label} para ${STATUS_META[status].label}`, actorName(), updatedAt)],
      }
    })
  }

  const assignResponsible = (protocolId: string, userId: string) => {
    const u = state.users.find((x) => x.id === userId)
    if (!u) return
    const now = new Date().toISOString()
    updateProtocol(protocolId, (p) => ({
      ...p,
      responsibleId: userId,
      updatedAt: now > p.updatedAt ? now : p.updatedAt,
      history: [...p.history, event('assigned', `Responsável alterado para ${u.name}`, actorName(), now)],
    }))
  }

  const addObservers = (protocolId: string, ids: string[]) => {
    const now = new Date().toISOString()
    updateProtocol(protocolId, (p) => {
      const newIds = ids.filter((id) => !p.observerIds.includes(id))
      const events = newIds.map((id) => {
        const o = state.observers.find((x) => x.id === id)
        return event('observer_added', `Observador ${o?.name ?? ''} adicionado`, actorName(), now)
      })
      return { ...p, observerIds: [...p.observerIds, ...newIds], history: [...p.history, ...events], updatedAt: now > p.updatedAt ? now : p.updatedAt }
    })
  }

  const removeObserver = (protocolId: string, id: string) => {
    const o = state.observers.find((x) => x.id === id)
    const now = new Date().toISOString()
    updateProtocol(protocolId, (p) => ({
      ...p,
      observerIds: p.observerIds.filter((x) => x !== id),
      history: [...p.history, event('observer_removed', `Observador ${o?.name ?? ''} removido`, actorName(), now)],
    }))
  }

  const addAttachments = (protocolId: string, attachments: Attachment[]) => {
    const now = new Date().toISOString()
    updateProtocol(protocolId, (p) => ({
      ...p,
      attachments: [...p.attachments, ...attachments],
      updatedAt: now > p.updatedAt ? now : p.updatedAt,
      history: [...p.history, event('attachment', `${attachments.length} anexo(s) adicionado(s): ${attachments.map((a) => a.name).join(', ')}`, actorName(), now)],
    }))
  }

  const upsert = <T extends { id: string }>(list: T[], item: T) =>
    list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

  const value: StoreValue = {
    ...state,
    currentUser,
    personas,
    setCurrentUser: (id) => setState((s) => ({ ...s, currentUserId: id })),
    getCategoryName: (id) => state.categories.find((c) => c.id === id)?.name ?? 'Sem categoria',
    getUser: (id) => state.users.find((u) => u.id === id),
    getObserver: (id) => state.observers.find((o) => o.id === id),
    createProtocol,
    sendMessage,
    changeStatus,
    assignResponsible,
    addObservers,
    removeObserver,
    addAttachments,
    saveCategory: (c) => setState((s) => ({ ...s, categories: upsert(s.categories, c) })),
    saveObserver: (o) => setState((s) => ({ ...s, observers: upsert(s.observers, o) })),
    saveUser: (u) => setState((s) => ({ ...s, users: upsert(s.users, u) })),
    updateSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    markNotificationRead: (id) => setState((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
    markAllNotificationsRead: () => setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
    resetDemo: () => setState(createInitialState()),
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore deve ser usado dentro de StoreProvider')
  return ctx
}
