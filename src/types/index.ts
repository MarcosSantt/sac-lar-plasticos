export type ProtocolStatus =
  | 'novo'
  | 'em_atendimento'
  | 'aguardando_cliente'
  | 'aguardando_terceiro'
  | 'resolvido'
  | 'fechado'

export type Priority = 'baixa' | 'media' | 'alta' | 'urgente'

export type RequestType = 'Reclamação' | 'Solicitação' | 'Dúvida' | 'Sugestão' | 'Elogio'

export type PersonRole = 'requester' | 'agent' | 'observer'

/** Usuário interno ou solicitante que pode "logar" na demo. */
export interface User {
  id: string
  name: string
  email: string
  phone?: string
  department: string
  role: 'requester' | 'agent'
  title: string
  active: boolean
}

export interface Observer {
  id: string
  name: string
  email: string
  department: string
  active: boolean
}

export interface Category {
  id: string
  name: string
  description: string
  active: boolean
}

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  uploadedBy: string
  createdAt: string
  /** Pré-visualização (apenas imagens pequenas) para a demo. */
  dataUrl?: string
}

export interface Author {
  id: string
  name: string
  role: PersonRole
}

export interface Message {
  id: string
  author: Author
  content: string
  attachments: Attachment[]
  createdAt: string
  /** Minutos desde a mensagem anterior (null na primeira mensagem). */
  responseTime: number | null
}

export type HistoryKind =
  | 'created'
  | 'observer_added'
  | 'observer_removed'
  | 'message'
  | 'status'
  | 'attachment'
  | 'assigned'

export interface HistoryEvent {
  id: string
  kind: HistoryKind
  description: string
  actor: string
  createdAt: string
}

export interface Requester {
  name: string
  email: string
  phone: string
}

export interface Protocol {
  id: string
  protocolNumber: string
  title: string
  description: string
  type: RequestType
  categoryId: string
  priority: Priority
  status: ProtocolStatus
  location: string
  requester: Requester
  responsibleId: string | null
  observerIds: string[]
  messages: Message[]
  attachments: Attachment[]
  history: HistoryEvent[]
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export interface Notification {
  id: string
  title: string
  body: string
  protocolNumber: string
  createdAt: string
  read: boolean
}

export interface Settings {
  companyName: string
  protocolPrefix: string
  nextSequence: number
  firstResponseTargetMin: number
  autoAssign: boolean
}

export interface Persona {
  id: string
  name: string
  email: string
  role: PersonRole
  subtitle: string
}
