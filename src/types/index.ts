export type ProtocolStatus =
  | 'novo'
  | 'em_atendimento'
  | 'aguardando_cliente'
  | 'aguardando_terceiro'
  | 'resolvido'
  | 'fechado'

export type Priority = 'baixa' | 'media' | 'alta' | 'urgente'

export type RequestType = 'Reclamação' | 'Solicitação' | 'Dúvida' | 'Sugestão' | 'Elogio'

/** Perfil da conta: vendedor, pós-vendas, coordenador comercial, equipe SAC ou observador. */
export type AccountRole = 'seller' | 'post_sales' | 'coordinator' | 'agent' | 'observer'

/** Papel de uma pessoa dentro de um protocolo (quem abriu é sempre o solicitante). */
export type PersonRole = 'requester' | 'agent' | 'observer' | 'coordinator' | 'post_sales'

/** Conta com acesso ao portal. Observadores ficam em uma lista própria. */
export interface User {
  id: string
  name: string
  email: string
  phone?: string
  department: string
  role: Exclude<AccountRole, 'observer'>
  title: string
  isAdmin: boolean
  active: boolean
  /** Vendedor: a equipe dele · coordenador e pós-vendas: as equipes que acompanham. */
  teamIds: string[]
}

/** Equipe comercial (carteira) à qual os protocolos pertencem. */
export interface Team {
  id: string
  name: string
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
  /** Endereço do arquivo no servidor (ou pré-visualização local, antes do envio). */
  url?: string
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
  | 'items'
  | 'details'
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
  /** Conta que abriu o protocolo. */
  requesterId: string
  requester: Requester
  /** Carteira do protocolo (nula nos protocolos anteriores às equipes). */
  teamId: string | null
  customerName: string
  invoiceNumber: string
  /** AAAA-MM-DD */
  invoiceDate: string | null
  orderNumber: string
  saleType: SaleType
  unit: string
  returnMethod: string
  returnInvoice: string
  items: ProtocolItem[]
  responsibleId: string | null
  observerIds: string[]
  messages: Message[]
  attachments: Attachment[]
  history: HistoryEvent[]
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export type SaleType = 'B2B' | 'B2C'

export interface ItemCosts {
  product: number
  /** Frete de coleta (devolução). */
  pickup: number
  /** Frete de envio (transportadora). */
  shipping: number
  postal: number
}

/** Item reclamado: o produto vem de quem abre; a classificação e os custos, da equipe SAC. */
export interface ProtocolItem {
  id: string
  productCode: string
  productName: string
  family: string
  quantity: number
  description: string
  location: string
  failureMode: string
  responsibleArea: string
  areaCode: string
  machinery: string
  treatment: string
  commercialConcession: boolean
  costs: ItemCosts
}

export interface Product {
  code: string
  name: string
  family: string
  active?: boolean
}

export type LookupKind = 'area' | 'failure_mode' | 'location' | 'treatment' | 'unit' | 'machinery' | 'return_method'

/** Opção das listas de classificação (área responsável, modo de falha...). */
export interface Lookup {
  id: string
  kind: LookupKind
  name: string
  /** Centro de resultado, no caso das áreas. */
  code: string
  active: boolean
}

export interface YearGoals {
  year: number
  prevSac: number
  prevFc: number
  sacReductionPct: number
  fcReductionPct: number
  prevPpm: number
  ppmReductionPct: number
}

export interface MonthProduction { year: number; month: number; kg: number }

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

/** Usuário autenticado. */
export interface Persona {
  id: string
  name: string
  email: string
  phone: string
  role: AccountRole
  subtitle: string
  isAdmin: boolean
  teamIds: string[]
}
