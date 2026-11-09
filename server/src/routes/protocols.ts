import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { currentUser, requireAuth } from '../auth.js'
import { pool, tx } from '../db.js'
import { badRequest } from '../errors.js'
import {
  addAttachments, addMessage, addObservers, assignResponsible, changeStatus, createProtocol, findAttachment,
  listProtocols, removeObserver,
} from '../protocols.js'
import { addItem, removeItem, updateDetails, updateItem } from '../items.js'
import { PRIORITIES, PROTOCOL_STATUSES, REQUEST_TYPES, type AuthUser } from '../types.js'
import { INLINE_TYPES, readMultipart, removeFiles, storagePath, type SavedFile } from '../uploads.js'

const idParam = z.object({ id: z.uuid() })
const itemParams = z.object({ id: z.uuid(), itemId: z.uuid() })

const text = (max: number) => z.string().trim().max(max).default('')
const isoDate = z.iso.date('Informe uma data válida.').nullable().default(null)
const quantity = z.number({ error: 'Informe a quantidade.' }).int('A quantidade precisa ser um número inteiro.').min(1, 'A quantidade precisa ser maior que zero.').max(1_000_000)
const money = z.number().min(0, 'Custos não podem ser negativos.').max(100_000_000).default(0)
const productCode = z.string().trim().min(1, 'Selecione o produto.').max(40)

const commercial = {
  customerName: z.string().trim().min(1, 'Informe o cliente (razão social).').max(200),
  invoiceNumber: z.string().trim().min(1, 'Informe o número da nota fiscal.').max(40),
  invoiceDate: isoDate,
  orderNumber: text(40),
  saleType: z.enum(['B2B', 'B2C']).default('B2B'),
}

const itemBody = z.object({
  productCode,
  quantity,
  description: text(2000),
  location: text(80),
  failureMode: text(80),
  responsibleArea: text(120),
  machinery: text(80),
  treatment: text(80),
  commercialConcession: z.boolean().default(false),
  costs: z.object({ product: money, pickup: money, shipping: money, postal: money }).default({ product: 0, pickup: 0, shipping: 0, postal: 0 }),
})

const detailsBody = z.object({
  ...commercial,
  unit: text(80),
  returnMethod: text(80),
  returnInvoice: text(40),
})

const newProtocol = z.object({
  requester: z.object({
    name: z.string().trim().min(1, 'Informe o nome do solicitante.').max(160),
    email: z.email('Informe um e-mail válido para o solicitante.').max(200),
    phone: z.string().trim().max(40).default(''),
  }),
  type: z.enum(REQUEST_TYPES),
  categoryId: z.uuid('Selecione uma categoria.'),
  title: z.string().trim().min(1, 'Informe o assunto.').max(120),
  priority: z.enum(PRIORITIES),
  location: z.string().trim().max(160).default(''),
  description: z.string().trim().min(15, 'Descreva a solicitação com pelo menos 15 caracteres.').max(10_000),
  observerIds: z.array(z.uuid()).max(50).default([]),
  teamId: z.uuid().optional(),
  ...commercial,
  items: z.array(z.object({ productCode, quantity, description: text(2000) }))
    .min(1, 'Informe ao menos um item reclamado.').max(50, 'Um protocolo aceita até 50 itens.'),
})

const patchProtocol = z.object({
  status: z.enum(PROTOCOL_STATUSES).optional(),
  responsibleId: z.uuid().optional(),
})

function parseJsonField(raw: string | undefined): unknown {
  try { return JSON.parse(raw ?? '') } catch { throw badRequest('Dados do formulário inválidos.') }
}

/** Executa a gravação em transação e apaga os arquivos enviados se algo der errado. */
async function withUploads<T>(files: SavedFile[], fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    await removeFiles(files)
    throw err
  }
}

async function bootstrap(user: AuthUser) {
  const seesEveryone = user.role === 'agent' || user.isAdmin
  const [accounts, categories, settings, protocols, notifications, teams, lookups, goals, production] = await Promise.all([
    pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.department, u.title, u.role, u.is_admin, u.active,
              ARRAY(SELECT ut.team_id FROM user_teams ut WHERE ut.user_id = u.id ORDER BY ut.team_id) AS team_ids
         FROM users u WHERE $1 OR u.role IN ('agent', 'observer') OR u.id = $2 ORDER BY u.name`,
      [seesEveryone, user.id]),
    pool.query('SELECT id, name, description, active FROM categories ORDER BY created_at, name'),
    pool.query('SELECT company_name, protocol_prefix, next_sequence, first_response_target_min, auto_assign FROM settings WHERE id = 1'),
    listProtocols(pool, user),
    pool.query('SELECT id, title, body, protocol_number, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40', [user.id]),
    pool.query('SELECT id, name, active FROM teams ORDER BY name'),
    pool.query('SELECT id, kind, name, code, active FROM lookups ORDER BY kind, position, name'),
    pool.query('SELECT * FROM yearly_goals ORDER BY year'),
    pool.query('SELECT year, month, kg FROM monthly_production ORDER BY year, month'),
  ])
  const s = settings.rows[0]
  return {
    // Contas com acesso ao portal; observadores vão em uma lista própria, como o portal os apresenta.
    users: accounts.rows.filter((u) => u.role !== 'observer').map((u) => ({
      id: u.id, name: u.name, email: u.email, phone: u.phone, department: u.department, title: u.title, role: u.role,
      isAdmin: u.is_admin, active: u.active, teamIds: u.team_ids,
    })),
    observers: accounts.rows.filter((u) => u.role === 'observer').map((u) => ({ id: u.id, name: u.name, email: u.email, department: u.department, active: u.active })),
    categories: categories.rows,
    teams: teams.rows,
    lookups: lookups.rows,
    goals: goals.rows.map((g) => ({
      year: g.year, prevSac: g.prev_sac, prevFc: g.prev_fc, sacReductionPct: Number(g.sac_reduction_pct),
      fcReductionPct: Number(g.fc_reduction_pct), prevPpm: Number(g.prev_ppm), ppmReductionPct: Number(g.ppm_reduction_pct),
    })),
    production: production.rows.map((r) => ({ year: r.year, month: r.month, kg: Number(r.kg) })),
    settings: {
      companyName: s.company_name, protocolPrefix: s.protocol_prefix, nextSequence: s.next_sequence,
      firstResponseTargetMin: s.first_response_target_min, autoAssign: s.auto_assign,
    },
    protocols,
    notifications: notifications.rows.map((n) => ({
      id: n.id, title: n.title, body: n.body, protocolNumber: n.protocol_number, read: n.read, createdAt: n.created_at.toISOString(),
    })),
  }
}

export async function protocolRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  /** Tudo o que o portal precisa para o usuário atual, já filtrado pelo que ele pode ver. */
  app.get('/api/bootstrap', async (req) => bootstrap(currentUser(req)))

  app.post('/api/protocols', async (req, reply) => {
    const user = currentUser(req)
    const { fields, files } = await readMultipart(req)
    const protocol = await withUploads(files, async () => {
      const input = newProtocol.parse(parseJsonField(fields.data))
      return tx((db) => createProtocol(db, user, input, files))
    })
    reply.code(201)
    return { protocol }
  })

  app.post('/api/protocols/:id/messages', async (req) => {
    const user = currentUser(req)
    const { id } = idParam.parse(req.params)
    const { fields, files } = await readMultipart(req)
    const protocol = await withUploads(files, async () => {
      const content = z.string().trim().max(10_000).parse(fields.content ?? '')
      if (!content && !files.length) throw badRequest('Escreva uma mensagem ou anexe um arquivo para enviar.')
      return tx((db) => addMessage(db, user, id, content, files))
    })
    return { protocol }
  })

  app.post('/api/protocols/:id/attachments', async (req) => {
    const user = currentUser(req)
    const { id } = idParam.parse(req.params)
    const { files } = await readMultipart(req)
    const protocol = await withUploads(files, () => tx((db) => addAttachments(db, user, id, files)))
    return { protocol }
  })

  app.patch('/api/protocols/:id', async (req) => {
    const user = currentUser(req)
    const { id } = idParam.parse(req.params)
    const body = patchProtocol.parse(req.body)
    if (!body.status && !body.responsibleId) throw badRequest('Nada para alterar.')
    const protocol = await tx(async (db) => {
      const assigned = body.responsibleId ? await assignResponsible(db, user, id, body.responsibleId) : null
      return body.status ? changeStatus(db, user, id, body.status) : assigned
    })
    return { protocol }
  })

  /** Busca no catálogo de produtos por código ou parte do nome. */
  app.get('/api/products', async (req) => {
    const { q } = z.object({ q: z.string().trim().max(80).default('') }).parse(req.query)
    if (!q) return { products: [] }
    const words = q.split(/\s+/).map((w) => `%${w.replace(/[\\%_]/g, '\\$&')}%`)
    const { rows } = await pool.query(
      `SELECT code, name, family FROM products
        WHERE active AND (code = $1 OR (SELECT bool_and(name ILIKE w) FROM unnest($2::text[]) AS w))
        ORDER BY code = $1 DESC, name LIMIT 20`,
      [q, words])
    return { products: rows }
  })

  app.patch('/api/protocols/:id/details', async (req) => {
    const { id } = idParam.parse(req.params)
    const body = detailsBody.parse(req.body)
    return { protocol: await tx((db) => updateDetails(db, currentUser(req), id, body)) }
  })

  app.post('/api/protocols/:id/items', async (req) => {
    const { id } = idParam.parse(req.params)
    const body = itemBody.parse(req.body)
    return { protocol: await tx((db) => addItem(db, currentUser(req), id, body)) }
  })

  app.put('/api/protocols/:id/items/:itemId', async (req) => {
    const { id, itemId } = itemParams.parse(req.params)
    const body = itemBody.parse(req.body)
    return { protocol: await tx((db) => updateItem(db, currentUser(req), id, itemId, body)) }
  })

  app.delete('/api/protocols/:id/items/:itemId', async (req) => {
    const { id, itemId } = itemParams.parse(req.params)
    return { protocol: await tx((db) => removeItem(db, currentUser(req), id, itemId)) }
  })

  app.post('/api/protocols/:id/observers', async (req) => {
    const { id } = idParam.parse(req.params)
    const { ids } = z.object({ ids: z.array(z.uuid()).min(1).max(50) }).parse(req.body)
    return { protocol: await tx((db) => addObservers(db, currentUser(req), id, ids)) }
  })

  app.delete('/api/protocols/:id/observers/:userId', async (req) => {
    const { id, userId } = z.object({ id: z.uuid(), userId: z.uuid() }).parse(req.params)
    return { protocol: await tx((db) => removeObserver(db, currentUser(req), id, userId)) }
  })

  app.get('/api/attachments/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params)
    const file = await findAttachment(pool, currentUser(req), id)
    const filePath = storagePath(file.storage_key)
    await fs.access(filePath).catch(() => { throw badRequest('O arquivo deste anexo não está mais disponível no servidor.') })

    const inline = INLINE_TYPES.has(file.mime_type)
    return reply
      .header('Content-Type', inline ? file.mime_type : 'application/octet-stream')
      .header('Content-Length', file.size)
      .header('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`)
      .header('Cache-Control', 'private, max-age=3600')
      .send(createReadStream(filePath))
  })

  app.post('/api/notifications/read', async (req) => {
    const { id } = z.object({ id: z.uuid().optional() }).parse(req.body ?? {})
    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND ($2::uuid IS NULL OR id = $2)', [currentUser(req).id, id ?? null])
    return { ok: true }
  })
}
