import type pg from 'pg'
import { badRequest, forbidden, notFound } from './errors.js'
import type { Db } from './db.js'
import type { SavedFile } from './uploads.js'
import { OPENER_ROLES, OPEN_STATUSES, ROLE_LABEL, STATUS_LABEL, type AuthUser, type ProtocolStatus, type Role } from './types.js'

type Tx = pg.PoolClient

interface ProtocolRow {
  id: string; protocol_number: string; title: string; description: string; type: string; category_id: string
  priority: string; status: ProtocolStatus; location: string; requester_id: string; requester_name: string
  requester_email: string; requester_phone: string; responsible_id: string | null; team_id: string | null
  customer_name: string; invoice_number: string; invoice_date: string | null; order_number: string; sale_type: string
  unit: string; return_method: string; return_invoice: string
  created_at: Date; updated_at: Date; closed_at: Date | null
}

interface ItemRow {
  id: string; protocol_id: string; product_code: string; product_name: string; family: string; quantity: number
  description: string; location: string; failure_mode: string; responsible_area: string; area_code: string
  machinery: string; treatment: string; commercial_concession: boolean
  cost_product: string; cost_pickup: string; cost_shipping: string; cost_postal: string
}

const itemDto = (i: ItemRow) => ({
  id: i.id,
  productCode: i.product_code,
  productName: i.product_name,
  family: i.family,
  quantity: i.quantity,
  description: i.description,
  location: i.location,
  failureMode: i.failure_mode,
  responsibleArea: i.responsible_area,
  areaCode: i.area_code,
  machinery: i.machinery,
  treatment: i.treatment,
  commercialConcession: i.commercial_concession,
  costs: { product: Number(i.cost_product), pickup: Number(i.cost_pickup), shipping: Number(i.cost_shipping), postal: Number(i.cost_postal) },
})

interface AttachmentRow {
  id: string; protocol_id: string; message_id: string | null; name: string; mime_type: string; size: string
  uploaded_by_name: string; created_at: Date
}

const attachmentDto = (a: AttachmentRow) => ({
  id: a.id,
  name: a.name,
  type: a.mime_type,
  size: Number(a.size),
  uploadedBy: a.uploaded_by_name,
  createdAt: a.created_at.toISOString(),
  url: `/api/attachments/${a.id}`,
})

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const list = map.get(k)
    if (list) list.push(row)
    else map.set(k, [row])
  }
  return map
}

/**
 * A equipe SAC vê tudo; coordenadores e pós-vendas, os protocolos das equipes a que estão vinculados;
 * todos veem os protocolos que abriram ou em que são observadores.
 */
const VISIBLE = `($1::text = 'agent' OR p.requester_id = $2
  OR EXISTS (SELECT 1 FROM protocol_observers o WHERE o.protocol_id = p.id AND o.user_id = $2)
  OR ($1::text IN ('coordinator', 'post_sales') AND EXISTS (
    SELECT 1 FROM user_teams ut WHERE ut.user_id = $2 AND ut.team_id = p.team_id)))`

async function hydrate(db: Db, rows: ProtocolRow[]) {
  if (!rows.length) return []
  const ids = [rows.map((r) => r.id)]
  // Consultas em sequência: dentro de uma transação todas usam a mesma conexão.
  const observers = await db.query<{ protocol_id: string; user_id: string }>(
    'SELECT protocol_id, user_id FROM protocol_observers WHERE protocol_id = ANY($1) ORDER BY created_at, user_id', ids)
  const messages = await db.query<{ id: string; protocol_id: string; author_id: string; author_name: string; author_role: Role; content: string; response_time_min: number | null; created_at: Date }>(
    'SELECT id, protocol_id, author_id, author_name, author_role, content, response_time_min, created_at FROM messages WHERE protocol_id = ANY($1) ORDER BY seq', ids)
  const attachments = await db.query<AttachmentRow>(
    'SELECT id, protocol_id, message_id, name, mime_type, size, uploaded_by_name, created_at FROM attachments WHERE protocol_id = ANY($1) ORDER BY seq', ids)
  const history = await db.query<{ id: string; protocol_id: string; kind: string; description: string; actor: string; created_at: Date }>(
    'SELECT id, protocol_id, kind, description, actor, created_at FROM history_events WHERE protocol_id = ANY($1) ORDER BY id', ids)
  const items = await db.query<ItemRow>('SELECT * FROM protocol_items WHERE protocol_id = ANY($1) ORDER BY seq', ids)
  const itemsBy = groupBy(items.rows, (r) => r.protocol_id)
  const observersBy = groupBy(observers.rows, (r) => r.protocol_id)
  const messagesBy = groupBy(messages.rows, (r) => r.protocol_id)
  const attachmentsBy = groupBy(attachments.rows, (r) => r.protocol_id)
  const attachmentsByMessage = groupBy(attachments.rows.filter((a) => a.message_id), (r) => r.message_id!)
  const historyBy = groupBy(history.rows, (r) => r.protocol_id)

  return rows.map((p) => ({
    id: p.id,
    protocolNumber: p.protocol_number,
    title: p.title,
    description: p.description,
    type: p.type,
    categoryId: p.category_id,
    priority: p.priority,
    status: p.status,
    location: p.location,
    requesterId: p.requester_id,
    requester: { name: p.requester_name, email: p.requester_email, phone: p.requester_phone },
    teamId: p.team_id,
    customerName: p.customer_name,
    invoiceNumber: p.invoice_number,
    invoiceDate: p.invoice_date,
    orderNumber: p.order_number,
    saleType: p.sale_type,
    unit: p.unit,
    returnMethod: p.return_method,
    returnInvoice: p.return_invoice,
    items: (itemsBy.get(p.id) ?? []).map(itemDto),
    responsibleId: p.responsible_id,
    observerIds: (observersBy.get(p.id) ?? []).map((o) => o.user_id),
    messages: (messagesBy.get(p.id) ?? []).map((m) => ({
      id: m.id,
      author: { id: m.author_id, name: m.author_name, role: m.author_role },
      content: m.content,
      attachments: (attachmentsByMessage.get(m.id) ?? []).map(attachmentDto),
      createdAt: m.created_at.toISOString(),
      responseTime: m.response_time_min,
    })),
    attachments: (attachmentsBy.get(p.id) ?? []).map(attachmentDto),
    history: (historyBy.get(p.id) ?? []).map((h) => ({
      id: `h_${h.id}`, kind: h.kind, description: h.description, actor: h.actor, createdAt: h.created_at.toISOString(),
    })),
    createdAt: p.created_at.toISOString(),
    updatedAt: p.updated_at.toISOString(),
    closedAt: p.closed_at?.toISOString() ?? null,
  }))
}

export type ProtocolDto = Awaited<ReturnType<typeof hydrate>>[number]

export async function listProtocols(db: Db, user: AuthUser): Promise<ProtocolDto[]> {
  const { rows } = await db.query<ProtocolRow>(`SELECT p.* FROM protocols p WHERE ${VISIBLE} ORDER BY p.updated_at DESC`, [user.role, user.id])
  return hydrate(db, rows)
}

export async function getProtocol(db: Db, id: string): Promise<ProtocolDto> {
  const { rows } = await db.query<ProtocolRow>('SELECT * FROM protocols WHERE id = $1', [id])
  return (await hydrate(db, rows))[0]
}

/** Trava o protocolo para alteração, garantindo que o usuário tem acesso a ele. */
export async function lockVisible(db: Tx, user: AuthUser, id: string): Promise<ProtocolRow> {
  const { rows } = await db.query<ProtocolRow>(`SELECT p.* FROM protocols p WHERE p.id = $3 AND ${VISIBLE} FOR UPDATE OF p`, [user.role, user.id, id])
  // Quem não participa recebe a mesma resposta de um protocolo inexistente.
  if (!rows[0]) throw notFound('Protocolo não encontrado.')
  return rows[0]
}

/** Papel da pessoa dentro de um protocolo específico. */
function roleIn(p: ProtocolRow, user: AuthUser): Role {
  if (p.requester_id === user.id) return 'requester'
  return user.role === 'seller' ? 'observer' : user.role
}

async function isVisible(db: Db, user: AuthUser, id: string): Promise<boolean> {
  return !!(await db.query(`SELECT 1 FROM protocols p WHERE p.id = $3 AND ${VISIBLE}`, [user.role, user.id, id])).rowCount
}

export async function addHistory(db: Tx, protocolId: string, kind: string, description: string, actor: string, at: Date) {
  await db.query('INSERT INTO history_events (protocol_id, kind, description, actor, created_at) VALUES ($1, $2, $3, $4, $5)', [protocolId, kind, description, actor, at])
}

async function saveAttachments(db: Tx, protocolId: string, messageId: string | null, files: SavedFile[], user: AuthUser, at: Date) {
  for (const f of files) {
    await db.query(
      `INSERT INTO attachments (protocol_id, message_id, name, mime_type, size, storage_key, uploaded_by_id, uploaded_by_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [protocolId, messageId, f.name, f.mimeType, f.size, f.storageKey, user.id, user.name, at],
    )
  }
  if (files.length) {
    await addHistory(db, protocolId, 'attachment', `${files.length} anexo(s) adicionado(s): ${files.map((f) => f.name).join(', ')}`, user.name, at)
  }
}

async function notify(db: Tx, userIds: (string | null)[], exceptId: string, n: { title: string; body: string; protocolNumber: string }, at: Date) {
  const targets = [...new Set(userIds.filter((id): id is string => !!id && id !== exceptId))]
  if (!targets.length) return
  await db.query(
    `INSERT INTO notifications (user_id, title, body, protocol_number, created_at)
     SELECT u.id, $2, $3, $4, $5 FROM users u WHERE u.id = ANY($1) AND u.active`,
    [targets, n.title, n.body, n.protocolNumber, at],
  )
}

async function observerIdsOf(db: Tx, protocolId: string): Promise<string[]> {
  const { rows } = await db.query<{ user_id: string }>('SELECT user_id FROM protocol_observers WHERE protocol_id = $1', [protocolId])
  return rows.map((r) => r.user_id)
}

async function activeAgentIds(db: Tx): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'agent' AND active`)
  return rows.map((r) => r.id)
}

/** Observadores válidos: contas ativas com perfil de observador. */
async function findObservers(db: Tx, ids: string[]): Promise<{ id: string; name: string }[]> {
  if (!ids.length) return []
  const { rows } = await db.query<{ id: string; name: string }>(`SELECT id, name FROM users WHERE id = ANY($1) AND role = 'observer' AND active ORDER BY name`, [ids])
  return rows
}

export interface NewProtocolInput {
  requester: { name: string; email: string; phone: string }
  type: string
  categoryId: string
  title: string
  priority: string
  location: string
  description: string
  observerIds: string[]
  /** Equipe do protocolo; o pós-vendas escolhe, o vendedor usa sempre a própria. */
  teamId?: string
  customerName: string
  invoiceNumber: string
  invoiceDate: string | null
  orderNumber: string
  saleType: 'B2B' | 'B2C'
  items: { productCode: string; quantity: number; description: string }[]
}

/** Produtos ativos do catálogo, na ordem pedida; recusa códigos desconhecidos. */
export async function findProducts(db: Db, codes: string[]): Promise<Map<string, { code: string; name: string; family: string }>> {
  const { rows } = await db.query<{ code: string; name: string; family: string }>('SELECT code, name, family FROM products WHERE code = ANY($1) AND active', [codes])
  const found = new Map(rows.map((r) => [r.code, r]))
  const missing = codes.filter((c) => !found.has(c))
  if (missing.length) throw badRequest(`Produto não encontrado no catálogo: ${missing.join(', ')}.`)
  return found
}

/** Carteira do novo protocolo, conforme o perfil de quem abre. */
async function teamForNewProtocol(db: Tx, user: AuthUser, requested: string | undefined): Promise<string> {
  if (!OPENER_ROLES.includes(user.role)) throw forbidden('Apenas vendedores e pós-vendas podem abrir protocolos.')
  if (user.role === 'seller') {
    if (user.teamIds.length !== 1) throw badRequest('Sua conta ainda não está vinculada a uma equipe. Fale com o administrador do portal.')
    return user.teamIds[0]
  }
  if (!requested) throw badRequest('Selecione a equipe do protocolo.')
  if (!user.teamIds.includes(requested)) throw badRequest('Você só pode abrir protocolos para as equipes que acompanha.')
  const team = await db.query('SELECT 1 FROM teams WHERE id = $1 AND active', [requested])
  if (!team.rowCount) throw badRequest('A equipe selecionada não está mais disponível.')
  return requested
}

export async function createProtocol(db: Tx, user: AuthUser, input: NewProtocolInput, files: SavedFile[]): Promise<ProtocolDto> {
  const teamId = await teamForNewProtocol(db, user, input.teamId)
  const products = await findProducts(db, [...new Set(input.items.map((i) => i.productCode))])
  const category = await db.query('SELECT 1 FROM categories WHERE id = $1 AND active', [input.categoryId])
  if (!category.rowCount) throw badRequest('A categoria selecionada não está mais disponível.')

  // A linha de configurações fica travada até o fim da transação: a numeração e a
  // distribuição automática nunca são calculadas por duas aberturas ao mesmo tempo.
  const settings = (await db.query<{ protocol_prefix: string; next_sequence: number; auto_assign: boolean }>(
    'SELECT protocol_prefix, next_sequence, auto_assign FROM settings WHERE id = 1 FOR UPDATE')).rows[0]
  const year = new Date().getFullYear()
  let sequence = settings.next_sequence
  let number = ''
  for (;;) {
    number = `${settings.protocol_prefix}-${year}-${String(sequence).padStart(5, '0')}`
    // Se a sequência foi reconfigurada para um número já usado, avança até o próximo livre.
    if (!(await db.query('SELECT 1 FROM protocols WHERE protocol_number = $1', [number])).rowCount) break
    sequence++
  }
  await db.query('UPDATE settings SET next_sequence = $1 WHERE id = 1', [sequence + 1])

  // Distribuição automática: atendente ativo com menos protocolos em aberto.
  const responsible = settings.auto_assign
    ? (await db.query<{ id: string; name: string }>(
        `SELECT u.id, u.name FROM users u
           LEFT JOIN protocols p ON p.responsible_id = u.id AND p.status = ANY($1)
          WHERE u.role = 'agent' AND u.active
          GROUP BY u.id ORDER BY count(p.id), u.name LIMIT 1`,
        [OPEN_STATUSES])).rows[0] ?? null
    : null

  const observers = (await findObservers(db, input.observerIds)).filter((o) => o.id !== user.id)
  const now = new Date()

  const id = (await db.query<{ id: string }>(
    `INSERT INTO protocols (protocol_number, title, description, type, category_id, priority, status, location,
                            requester_id, requester_name, requester_email, requester_phone, responsible_id, team_id,
                            customer_name, invoice_number, invoice_date, order_number, sale_type, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'novo', $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19) RETURNING id`,
    [number, input.title, input.description, input.type, input.categoryId, input.priority, input.location,
      user.id, input.requester.name, input.requester.email, input.requester.phone, responsible?.id ?? null, teamId,
      input.customerName, input.invoiceNumber, input.invoiceDate, input.orderNumber, input.saleType, now])).rows[0].id
  for (const item of input.items) {
    const product = products.get(item.productCode)!
    await db.query(
      `INSERT INTO protocol_items (protocol_id, product_code, product_name, family, quantity, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, product.code, product.name, product.family, item.quantity, item.description, now])
  }

  await addHistory(db, id, 'created', 'Protocolo criado', user.name, now)
  if (responsible) await addHistory(db, id, 'assigned', `Atribuído automaticamente a ${responsible.name}`, 'Sistema', now)
  for (const o of observers) {
    await db.query('INSERT INTO protocol_observers (protocol_id, user_id) VALUES ($1, $2)', [id, o.id])
    await addHistory(db, id, 'observer_added', `Observador ${o.name} adicionado`, user.name, now)
  }

  const messageId = (await db.query<{ id: string }>(
    `INSERT INTO messages (protocol_id, author_id, author_name, author_role, content, created_at)
     VALUES ($1, $2, $3, 'requester', $4, $5) RETURNING id`,
    [id, user.id, user.name, input.description, now])).rows[0].id
  await saveAttachments(db, id, messageId, files, user, now)

  const subject = `${number} · ${input.title}`
  await notify(db, responsible ? [responsible.id] : await activeAgentIds(db), user.id,
    { title: `Novo protocolo ${number}`, body: responsible ? `Atribuído a você: ${input.title}` : `Aguardando atribuição: ${input.title}`, protocolNumber: number }, now)
  await notify(db, observers.map((o) => o.id), user.id,
    { title: `Você foi adicionado como observador`, body: `${user.name} incluiu você em ${subject}`, protocolNumber: number }, now)

  return getProtocol(db, id)
}

export async function addMessage(db: Tx, user: AuthUser, protocolId: string, content: string, files: SavedFile[]): Promise<ProtocolDto> {
  const p = await lockVisible(db, user, protocolId)
  const role = roleIn(p, user)

  const last = (await db.query<{ created_at: Date }>('SELECT created_at FROM messages WHERE protocol_id = $1 ORDER BY seq DESC LIMIT 1', [p.id])).rows[0]
  const lastTime = (last?.created_at ?? p.created_at).getTime()
  const now = new Date(Math.max(Date.now(), lastTime))
  // Tempo de resposta = intervalo desde a mensagem anterior.
  const responseTime = (now.getTime() - lastTime) / 60000

  const messageId = (await db.query<{ id: string }>(
    `INSERT INTO messages (protocol_id, author_id, author_name, author_role, content, response_time_min, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [p.id, user.id, user.name, role, content, responseTime, now])).rows[0].id
  if (content) await addHistory(db, p.id, 'message', `${ROLE_LABEL[role]} ${user.name} enviou mensagem`, user.name, now)
  await saveAttachments(db, p.id, messageId, files, user, now)

  // Transições automáticas de status.
  let status = p.status
  if (role === 'agent' && p.status === 'novo') status = 'em_atendimento'
  if (role === 'requester' && p.status === 'aguardando_cliente') status = 'em_atendimento'
  if (status !== p.status) {
    await addHistory(db, p.id, 'status', `Status alterado automaticamente de ${STATUS_LABEL[p.status]} para ${STATUS_LABEL[status]}`, 'Sistema', now)
  }
  await db.query('UPDATE protocols SET status = $2, updated_at = $3 WHERE id = $1', [p.id, status, now])

  const audience = [p.requester_id, ...(p.responsible_id ? [p.responsible_id] : await activeAgentIds(db)), ...(await observerIdsOf(db, p.id))]
  await notify(db, audience, user.id,
    { title: `Novo comentário no protocolo ${p.protocol_number}`, body: `${user.name} respondeu ao protocolo.`, protocolNumber: p.protocol_number }, now)

  return getProtocol(db, p.id)
}

export async function addAttachments(db: Tx, user: AuthUser, protocolId: string, files: SavedFile[]): Promise<ProtocolDto> {
  if (!files.length) throw badRequest('Selecione ao menos um arquivo.')
  const p = await lockVisible(db, user, protocolId)
  const now = new Date()
  await saveAttachments(db, p.id, null, files, user, now)
  await db.query('UPDATE protocols SET updated_at = greatest(updated_at, $2) WHERE id = $1', [p.id, now])
  return getProtocol(db, p.id)
}

export async function changeStatus(db: Tx, user: AuthUser, protocolId: string, status: ProtocolStatus): Promise<ProtocolDto> {
  if (user.role !== 'agent') throw forbidden('Apenas a equipe SAC pode alterar o status.')
  const p = await lockVisible(db, user, protocolId)
  if (p.status === status) return getProtocol(db, p.id)

  const now = new Date(Math.max(Date.now(), p.updated_at.getTime()))
  const closing = status === 'resolvido' || status === 'fechado'
  await db.query('UPDATE protocols SET status = $2, updated_at = $3, closed_at = $4 WHERE id = $1', [p.id, status, now, closing ? (p.closed_at ?? now) : null])
  const change = `de ${STATUS_LABEL[p.status]} para ${STATUS_LABEL[status]}`
  await addHistory(db, p.id, 'status', `Status alterado ${change}`, user.name, now)
  await notify(db, [p.requester_id, ...(await observerIdsOf(db, p.id))], user.id,
    { title: `Status do protocolo ${p.protocol_number} atualizado`, body: `${user.name} alterou o status ${change}.`, protocolNumber: p.protocol_number }, now)
  return getProtocol(db, p.id)
}

export async function assignResponsible(db: Tx, user: AuthUser, protocolId: string, responsibleId: string): Promise<ProtocolDto> {
  if (user.role !== 'agent') throw forbidden('Apenas a equipe SAC pode alterar o responsável.')
  const p = await lockVisible(db, user, protocolId)
  if (p.responsible_id === responsibleId) return getProtocol(db, p.id)
  const agent = (await db.query<{ id: string; name: string }>(`SELECT id, name FROM users WHERE id = $1 AND role = 'agent' AND active`, [responsibleId])).rows[0]
  if (!agent) throw badRequest('O responsável precisa ser um atendente ativo da equipe SAC.')

  const now = new Date()
  await db.query('UPDATE protocols SET responsible_id = $2, updated_at = greatest(updated_at, $3) WHERE id = $1', [p.id, agent.id, now])
  await addHistory(db, p.id, 'assigned', `Responsável alterado para ${agent.name}`, user.name, now)
  await notify(db, [agent.id], user.id,
    { title: `Protocolo ${p.protocol_number} atribuído a você`, body: `${user.name} definiu você como responsável: ${p.title}`, protocolNumber: p.protocol_number }, now)
  return getProtocol(db, p.id)
}

export async function addObservers(db: Tx, user: AuthUser, protocolId: string, ids: string[]): Promise<ProtocolDto> {
  const p = await lockVisible(db, user, protocolId)
  const current = new Set(await observerIdsOf(db, p.id))
  const added = (await findObservers(db, ids)).filter((o) => !current.has(o.id) && o.id !== p.requester_id)
  const now = new Date()
  for (const o of added) {
    await db.query('INSERT INTO protocol_observers (protocol_id, user_id) VALUES ($1, $2)', [p.id, o.id])
    await addHistory(db, p.id, 'observer_added', `Observador ${o.name} adicionado`, user.name, now)
  }
  if (added.length) {
    await db.query('UPDATE protocols SET updated_at = greatest(updated_at, $2) WHERE id = $1', [p.id, now])
    await notify(db, added.map((o) => o.id), user.id,
      { title: 'Você foi adicionado como observador', body: `${user.name} incluiu você em ${p.protocol_number} · ${p.title}`, protocolNumber: p.protocol_number }, now)
  }
  return getProtocol(db, p.id)
}

export async function removeObserver(db: Tx, user: AuthUser, protocolId: string, observerId: string): Promise<ProtocolDto | null> {
  const p = await lockVisible(db, user, protocolId)
  // A equipe SAC e quem abriu o protocolo removem qualquer observador; o observador pode sair por conta própria.
  if (user.role !== 'agent' && p.requester_id !== user.id && observerId !== user.id) {
    throw forbidden('Apenas a equipe SAC ou o solicitante podem remover observadores.')
  }
  const removed = (await db.query<{ name: string }>(
    `DELETE FROM protocol_observers o USING users u
      WHERE o.protocol_id = $1 AND o.user_id = $2 AND u.id = o.user_id RETURNING u.name`,
    [p.id, observerId])).rows[0]
  if (removed) await addHistory(db, p.id, 'observer_removed', `Observador ${removed.name} removido`, user.name, new Date())
  // Quem removeu a si mesmo pode deixar de ter acesso ao protocolo.
  return (await isVisible(db, user, p.id)) ? getProtocol(db, p.id) : null
}

/** Localiza um anexo, desde que o usuário participe do protocolo ao qual ele pertence. */
export async function findAttachment(db: Db, user: AuthUser, id: string) {
  const { rows } = await db.query<{ name: string; mime_type: string; size: string; storage_key: string }>(
    `SELECT a.name, a.mime_type, a.size, a.storage_key
       FROM attachments a JOIN protocols p ON p.id = a.protocol_id
      WHERE a.id = $3 AND ${VISIBLE}`,
    [user.role, user.id, id],
  )
  if (!rows[0]) throw notFound('Anexo não encontrado.')
  return rows[0]
}
