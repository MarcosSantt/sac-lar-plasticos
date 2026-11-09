import type pg from 'pg'
import { badRequest, forbidden } from './errors.js'
import type { Db } from './db.js'
import { addHistory, findProducts, getProtocol, lockVisible, type ProtocolDto } from './protocols.js'
import type { AuthUser } from './types.js'

type Tx = pg.PoolClient

export const LOOKUP_KINDS = ['area', 'failure_mode', 'location', 'treatment', 'unit', 'machinery', 'return_method'] as const
export type LookupKind = (typeof LOOKUP_KINDS)[number]

const LOOKUP_LABEL: Record<LookupKind, string> = {
  area: 'área responsável', failure_mode: 'modo de falha', location: 'local', treatment: 'tratativa',
  unit: 'unidade', machinery: 'maquinário', return_method: 'logística de retorno',
}

function requireSac(user: AuthUser) {
  if (user.role !== 'agent') throw forbidden('Apenas a equipe SAC pode classificar os itens do protocolo.')
}

/**
 * Confere um valor de lista. Vazio significa "não classificado"; o valor atual continua
 * aceito mesmo que a opção tenha sido desativada depois.
 */
async function checkLookup(db: Db, kind: LookupKind, name: string, current = ''): Promise<{ name: string; code: string }> {
  if (!name) return { name: '', code: '' }
  const { rows } = await db.query<{ name: string; code: string; active: boolean }>(
    'SELECT name, code, active FROM lookups WHERE kind = $1 AND lower(name) = lower($2)', [kind, name])
  const row = rows[0]
  if (!row || (!row.active && row.name !== current)) throw badRequest(`Opção de ${LOOKUP_LABEL[kind]} inválida: ${name}.`)
  return { name: row.name, code: row.code }
}

export interface DetailsInput {
  customerName: string
  invoiceNumber: string
  invoiceDate: string | null
  orderNumber: string
  saleType: 'B2B' | 'B2C'
  unit: string
  returnMethod: string
  returnInvoice: string
}

/** Dados comerciais e de logística do protocolo, mantidos pela equipe SAC. */
export async function updateDetails(db: Tx, user: AuthUser, protocolId: string, input: DetailsInput): Promise<ProtocolDto> {
  requireSac(user)
  const p = await lockVisible(db, user, protocolId)
  const unit = await checkLookup(db, 'unit', input.unit, p.unit)
  const returnMethod = await checkLookup(db, 'return_method', input.returnMethod, p.return_method)
  const now = new Date()
  await db.query(
    `UPDATE protocols SET customer_name = $2, invoice_number = $3, invoice_date = $4, order_number = $5, sale_type = $6,
            unit = $7, return_method = $8, return_invoice = $9, updated_at = greatest(updated_at, $10) WHERE id = $1`,
    [p.id, input.customerName, input.invoiceNumber, input.invoiceDate, input.orderNumber, input.saleType,
      unit.name, returnMethod.name, input.returnInvoice, now])
  await addHistory(db, p.id, 'details', 'Dados do cliente e da logística atualizados', user.name, now)
  return getProtocol(db, p.id)
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
  costs: { product: number; pickup: number; shipping: number; postal: number }
}

interface CurrentItem { id: string; seq: string; product_code: string; product_name: string; family: string; location: string; failure_mode: string; responsible_area: string; machinery: string; treatment: string }

async function itemValues(db: Tx, input: ItemInput, current?: CurrentItem) {
  // Trocar o produto busca os dados atuais do catálogo; manter o mesmo preserva o que foi gravado.
  const product = current && current.product_code === input.productCode
    ? { code: current.product_code, name: current.product_name, family: current.family }
    : (await findProducts(db, [input.productCode])).get(input.productCode)!
  const area = await checkLookup(db, 'area', input.responsibleArea, current?.responsible_area)
  return {
    product,
    location: (await checkLookup(db, 'location', input.location, current?.location)).name,
    failureMode: (await checkLookup(db, 'failure_mode', input.failureMode, current?.failure_mode)).name,
    area,
    machinery: (await checkLookup(db, 'machinery', input.machinery, current?.machinery)).name,
    treatment: (await checkLookup(db, 'treatment', input.treatment, current?.treatment)).name,
  }
}

/** Posição do item no protocolo (1, 2, 3...), usada no histórico. */
async function itemNumber(db: Tx, protocolId: string, seq: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>('SELECT count(*) AS n FROM protocol_items WHERE protocol_id = $1 AND seq <= $2', [protocolId, seq])
  return Number(rows[0].n)
}

export async function addItem(db: Tx, user: AuthUser, protocolId: string, input: ItemInput): Promise<ProtocolDto> {
  requireSac(user)
  const p = await lockVisible(db, user, protocolId)
  const v = await itemValues(db, input)
  const now = new Date()
  await db.query(
    `INSERT INTO protocol_items (protocol_id, product_code, product_name, family, quantity, description, location, failure_mode,
                                 responsible_area, area_code, machinery, treatment, commercial_concession,
                                 cost_product, cost_pickup, cost_shipping, cost_postal, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [p.id, v.product.code, v.product.name, v.product.family, input.quantity, input.description, v.location, v.failureMode,
      v.area.name, v.area.code, v.machinery, v.treatment, input.commercialConcession,
      input.costs.product, input.costs.pickup, input.costs.shipping, input.costs.postal, now])
  await addHistory(db, p.id, 'items', `Item adicionado: ${input.quantity} × ${v.product.name}`, user.name, now)
  await db.query('UPDATE protocols SET updated_at = greatest(updated_at, $2) WHERE id = $1', [p.id, now])
  return getProtocol(db, p.id)
}

export async function updateItem(db: Tx, user: AuthUser, protocolId: string, itemId: string, input: ItemInput): Promise<ProtocolDto> {
  requireSac(user)
  const p = await lockVisible(db, user, protocolId)
  const current = (await db.query<CurrentItem>('SELECT * FROM protocol_items WHERE id = $1 AND protocol_id = $2', [itemId, p.id])).rows[0]
  if (!current) throw badRequest('Item não encontrado neste protocolo.')
  const v = await itemValues(db, input, current)
  const now = new Date()
  await db.query(
    `UPDATE protocol_items SET product_code = $2, product_name = $3, family = $4, quantity = $5, description = $6, location = $7,
            failure_mode = $8, responsible_area = $9, area_code = $10, machinery = $11, treatment = $12, commercial_concession = $13,
            cost_product = $14, cost_pickup = $15, cost_shipping = $16, cost_postal = $17
      WHERE id = $1`,
    [itemId, v.product.code, v.product.name, v.product.family, input.quantity, input.description, v.location, v.failureMode,
      v.area.name, v.area.code, v.machinery, v.treatment, input.commercialConcession,
      input.costs.product, input.costs.pickup, input.costs.shipping, input.costs.postal])
  const summary = [v.failureMode, v.area.name, v.treatment].filter(Boolean).join(' · ')
  await addHistory(db, p.id, 'items', `Item ${await itemNumber(db, p.id, current.seq)} atualizado${summary ? `: ${summary}` : ''}`, user.name, now)
  await db.query('UPDATE protocols SET updated_at = greatest(updated_at, $2) WHERE id = $1', [p.id, now])
  return getProtocol(db, p.id)
}

export async function removeItem(db: Tx, user: AuthUser, protocolId: string, itemId: string): Promise<ProtocolDto> {
  requireSac(user)
  const p = await lockVisible(db, user, protocolId)
  const count = Number((await db.query<{ n: string }>('SELECT count(*) AS n FROM protocol_items WHERE protocol_id = $1', [p.id])).rows[0].n)
  const removed = (await db.query<{ product_name: string; quantity: number }>(
    'DELETE FROM protocol_items WHERE id = $1 AND protocol_id = $2 AND $3 > 1 RETURNING product_name, quantity', [itemId, p.id, count])).rows[0]
  if (!removed) throw badRequest(count > 1 ? 'Item não encontrado neste protocolo.' : 'O protocolo precisa ter ao menos um item.')
  const now = new Date()
  await addHistory(db, p.id, 'items', `Item removido: ${removed.quantity} × ${removed.product_name}`, user.name, now)
  await db.query('UPDATE protocols SET updated_at = greatest(updated_at, $2) WHERE id = $1', [p.id, now])
  return getProtocol(db, p.id)
}
