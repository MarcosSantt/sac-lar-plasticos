import type { FastifyInstance } from 'fastify'
import type pg from 'pg'
import { z } from 'zod'
import { currentUser, destroyUserSessions, generateTemporaryPassword, hashPassword, requireAdmin } from '../auth.js'
import { pool, tx } from '../db.js'
import { badRequest, conflict, notFound } from '../errors.js'
import { LOOKUP_KINDS } from '../items.js'
import { ACCOUNT_ROLES, type AccountRole } from '../types.js'

const idParam = z.object({ id: z.uuid() })

const categoryBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome da categoria.').max(80),
  description: z.string().trim().max(400).default(''),
  active: z.boolean().default(true),
})

const lookupBody = z.object({
  kind: z.enum(LOOKUP_KINDS),
  name: z.string().trim().min(1, 'Informe o nome.').max(120),
  code: z.string().trim().max(40).default(''),
  active: z.boolean().default(true),
})

const productBody = z.object({
  code: z.string().trim().min(1, 'Informe o código do produto.').max(40),
  name: z.string().trim().min(1, 'Informe a descrição do produto.').max(200),
  family: z.string().trim().max(80).default(''),
  active: z.boolean().default(true),
})

const pct = z.number().min(0).max(100)
const goalsBody = z.object({
  prevSac: z.number().int().min(0).max(10_000_000),
  prevFc: z.number().int().min(0).max(10_000_000),
  sacReductionPct: pct,
  fcReductionPct: pct,
  prevPpm: z.number().min(0).max(1_000_000),
  ppmReductionPct: pct,
  // Produção de cada mês (kg); nulo = ainda não lançada.
  production: z.array(z.number().min(0).max(1e12).nullable()).length(12),
})

const teamBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome da equipe.').max(80),
  active: z.boolean().default(true),
})

const userBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(160),
  email: z.email('Informe um e-mail válido.').max(200),
  phone: z.string().trim().max(40).default(''),
  department: z.string().trim().max(80).default(''),
  title: z.string().trim().max(80).default(''),
  role: z.enum(ACCOUNT_ROLES),
  isAdmin: z.boolean().default(false),
  active: z.boolean().default(true),
  teamIds: z.array(z.uuid()).max(50).default([]),
}).transform((u) => ({
  ...u,
  // Somente a equipe SAC administra o portal; equipes só valem para quem trabalha por carteira.
  isAdmin: u.role === 'agent' && u.isAdmin,
  teamIds: TEAM_RULE[u.role] === 'none' ? [] : [...new Set(u.teamIds)],
})).superRefine((u, ctx) => {
  const rule = TEAM_RULE[u.role]
  if (rule === 'one' && u.teamIds.length !== 1) ctx.addIssue({ code: 'custom', message: 'Selecione a equipe do vendedor.', path: ['teamIds'] })
  if (rule === 'many' && !u.teamIds.length) ctx.addIssue({ code: 'custom', message: 'Selecione ao menos uma equipe.', path: ['teamIds'] })
})

const settingsBody = z.object({
  companyName: z.string().trim().min(1).max(120),
  protocolPrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, 'O prefixo aceita até 6 letras ou números.'),
  nextSequence: z.number().int().min(1).max(99_999_999),
  firstResponseTargetMin: z.number().int().min(1).max(100_000),
  autoAssign: z.boolean(),
})

/** Quantas equipes cada perfil tem. */
const TEAM_RULE: Record<AccountRole, 'none' | 'one' | 'many'> = {
  seller: 'one', post_sales: 'many', coordinator: 'many', agent: 'none', observer: 'none',
}

/** Substitui as equipes da conta, conferindo se todas existem. */
async function setUserTeams(db: pg.PoolClient, userId: string, teamIds: string[]) {
  const found = await db.query('SELECT 1 FROM teams WHERE id = ANY($1)', [teamIds])
  if (found.rowCount !== teamIds.length) throw badRequest('Uma das equipes selecionadas não existe mais.')
  await db.query('DELETE FROM user_teams WHERE user_id = $1', [userId])
  await db.query('INSERT INTO user_teams (user_id, team_id) SELECT $1, unnest($2::uuid[])', [userId, teamIds])
}

const isUniqueViolation = (err: unknown) => (err as { code?: string }).code === '23505'

type UserRow = { id: string; name: string; email: string; phone: string; department: string; title: string; role: string; is_admin: boolean; active: boolean }

const userDto = (u: UserRow, teamIds: string[]) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, department: u.department, title: u.title, role: u.role,
  isAdmin: u.is_admin, active: u.active, teamIds,
})

const USER_COLUMNS = 'id, name, email, phone, department, title, role, is_admin, active'

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin)

  app.post('/api/admin/categories', async (req, reply) => {
    const body = categoryBody.parse(req.body)
    try {
      const { rows } = await pool.query('INSERT INTO categories (name, description, active) VALUES ($1, $2, $3) RETURNING id, name, description, active', [body.name, body.description, body.active])
      reply.code(201)
      return { category: rows[0] }
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Já existe uma categoria com este nome.')
      throw err
    }
  })

  app.patch('/api/admin/categories/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const body = categoryBody.parse(req.body)
    try {
      const { rows } = await pool.query('UPDATE categories SET name = $2, description = $3, active = $4 WHERE id = $1 RETURNING id, name, description, active', [id, body.name, body.description, body.active])
      if (!rows[0]) throw notFound('Categoria não encontrada.')
      return { category: rows[0] }
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Já existe uma categoria com este nome.')
      throw err
    }
  })

  app.post('/api/admin/lookups', async (req, reply) => {
    const body = lookupBody.parse(req.body)
    try {
      const { rows } = await pool.query(
        `INSERT INTO lookups (kind, name, code, active, position)
         VALUES ($1, $2, $3, $4, (SELECT coalesce(max(position), -1) + 1 FROM lookups WHERE kind = $1))
         RETURNING id, kind, name, code, active`,
        [body.kind, body.name, body.code, body.active])
      reply.code(201)
      return { lookup: rows[0] }
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Esta opção já existe na lista.')
      throw err
    }
  })

  app.patch('/api/admin/lookups/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const body = lookupBody.omit({ kind: true }).parse(req.body)
    try {
      const { rows } = await pool.query('UPDATE lookups SET name = $2, code = $3, active = $4 WHERE id = $1 RETURNING id, kind, name, code, active', [id, body.name, body.code, body.active])
      if (!rows[0]) throw notFound('Opção não encontrada.')
      return { lookup: rows[0] }
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Esta opção já existe na lista.')
      throw err
    }
  })

  app.get('/api/admin/products', async (req) => {
    const { q } = z.object({ q: z.string().trim().max(80).default('') }).parse(req.query)
    const words = q ? q.split(/\s+/).map((w) => `%${w.replace(/[\\%_]/g, '\\$&')}%`) : []
    const { rows } = await pool.query(
      `SELECT code, name, family, active, count(*) OVER ()::int AS total FROM products
        WHERE $1 = '' OR code = $1 OR (SELECT bool_and(name ILIKE w OR family ILIKE w) FROM unnest($2::text[]) AS w)
        ORDER BY name LIMIT 100`,
      [q, words])
    return { products: rows.map((p) => ({ code: p.code, name: p.name, family: p.family, active: p.active })), total: rows[0]?.total ?? 0 }
  })

  app.post('/api/admin/products', async (req, reply) => {
    const body = productBody.parse(req.body)
    try {
      const { rows } = await pool.query('INSERT INTO products (code, name, family, active) VALUES ($1, $2, $3, $4) RETURNING code, name, family, active', [body.code, body.name, body.family, body.active])
      reply.code(201)
      return { product: rows[0] }
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Já existe um produto com este código.')
      throw err
    }
  })

  app.patch('/api/admin/products/:code', async (req) => {
    const { code } = z.object({ code: z.string().min(1).max(40) }).parse(req.params)
    const body = productBody.omit({ code: true }).parse(req.body)
    const { rows } = await pool.query('UPDATE products SET name = $2, family = $3, active = $4 WHERE code = $1 RETURNING code, name, family, active', [code, body.name, body.family, body.active])
    if (!rows[0]) throw notFound('Produto não encontrado.')
    return { product: rows[0] }
  })

  /** Metas do ano e produção mensal, usadas na seção Objetivos e Metas do dashboard. */
  app.put('/api/admin/goals/:year', async (req) => {
    const { year } = z.object({ year: z.coerce.number().int().min(2000).max(2100) }).parse(req.params)
    const body = goalsBody.parse(req.body)
    await tx(async (db) => {
      await db.query(
        `INSERT INTO yearly_goals (year, prev_sac, prev_fc, sac_reduction_pct, fc_reduction_pct, prev_ppm, ppm_reduction_pct)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (year) DO UPDATE SET prev_sac = $2, prev_fc = $3, sac_reduction_pct = $4, fc_reduction_pct = $5, prev_ppm = $6, ppm_reduction_pct = $7`,
        [year, body.prevSac, body.prevFc, body.sacReductionPct, body.fcReductionPct, body.prevPpm, body.ppmReductionPct])
      await db.query('DELETE FROM monthly_production WHERE year = $1', [year])
      for (const [i, kg] of body.production.entries()) {
        if (kg != null) await db.query('INSERT INTO monthly_production (year, month, kg) VALUES ($1, $2, $3)', [year, i + 1, kg])
      }
    })
    return { ok: true }
  })

  app.post('/api/admin/teams', async (req, reply) => {
    const body = teamBody.parse(req.body)
    try {
      const { rows } = await pool.query('INSERT INTO teams (name, active) VALUES ($1, $2) RETURNING id, name, active', [body.name, body.active])
      reply.code(201)
      return { team: rows[0] }
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Já existe uma equipe com este nome.')
      throw err
    }
  })

  app.patch('/api/admin/teams/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const body = teamBody.parse(req.body)
    try {
      const { rows } = await pool.query('UPDATE teams SET name = $2, active = $3 WHERE id = $1 RETURNING id, name, active', [id, body.name, body.active])
      if (!rows[0]) throw notFound('Equipe não encontrada.')
      return { team: rows[0] }
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Já existe uma equipe com este nome.')
      throw err
    }
  })

  /** Cria a conta com uma senha provisória, exibida uma única vez para quem está cadastrando. */
  app.post('/api/admin/users', async (req, reply) => {
    const body = userBody.parse(req.body)
    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await hashPassword(temporaryPassword)
    try {
      const user = await tx(async (db) => {
        const { rows } = await db.query<UserRow>(
          `INSERT INTO users (name, email, phone, department, title, role, is_admin, active, password_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${USER_COLUMNS}`,
          [body.name, body.email, body.phone, body.department, body.title, body.role, body.isAdmin, body.active, passwordHash])
        await setUserTeams(db, rows[0].id, body.teamIds)
        return userDto(rows[0], body.teamIds)
      })
      reply.code(201)
      return { user, temporaryPassword }
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Este e-mail já está cadastrado.')
      throw err
    }
  })

  app.patch('/api/admin/users/:id', async (req) => {
    const { id } = idParam.parse(req.params)
    const body = userBody.parse(req.body)
    if (id === currentUser(req).id && (!body.active || !body.isAdmin)) {
      throw badRequest('Você não pode desativar a própria conta nem remover o seu acesso de administrador.')
    }
    try {
      return await tx(async (db) => {
        const { rows } = await db.query<UserRow>(
          `UPDATE users SET name = $2, email = $3, phone = $4, department = $5, title = $6, role = $7, is_admin = $8, active = $9
            WHERE id = $1 RETURNING ${USER_COLUMNS}`,
          [id, body.name, body.email, body.phone, body.department, body.title, body.role, body.isAdmin, body.active])
        if (!rows[0]) throw notFound('Usuário não encontrado.')
        await setUserTeams(db, id, body.teamIds)
        if (!body.active) await destroyUserSessions(db, id)
        return { user: userDto(rows[0], body.teamIds) }
      })
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('Este e-mail já está cadastrado.')
      throw err
    }
  })

  app.post('/api/admin/users/:id/reset-password', async (req) => {
    const { id } = idParam.parse(req.params)
    const temporaryPassword = generateTemporaryPassword()
    const hash = await hashPassword(temporaryPassword)
    return tx(async (db) => {
      const { rows } = await db.query<UserRow & { team_ids: string[] }>(
        `UPDATE users u SET password_hash = $2, must_change_password = true WHERE id = $1
         RETURNING ${USER_COLUMNS}, ARRAY(SELECT ut.team_id FROM user_teams ut WHERE ut.user_id = u.id ORDER BY ut.team_id) AS team_ids`, [id, hash])
      if (!rows[0]) throw notFound('Usuário não encontrado.')
      await destroyUserSessions(db, id, id === currentUser(req).id ? req.sessionHash : null)
      return { user: userDto(rows[0], rows[0].team_ids), temporaryPassword }
    })
  })

  app.patch('/api/admin/settings', async (req) => {
    const body = settingsBody.parse(req.body)
    await pool.query(
      'UPDATE settings SET company_name = $1, protocol_prefix = $2, next_sequence = $3, first_response_target_min = $4, auto_assign = $5 WHERE id = 1',
      [body.companyName, body.protocolPrefix, body.nextSequence, body.firstResponseTargetMin, body.autoAssign])
    return { settings: body }
  })
}
