import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  MIN_PASSWORD_LENGTH, SESSION_COOKIE, burnPasswordCheck, clearSessionCookie, createSession, currentUser, destroySession,
  destroyUserSessions, hashPassword, requireSession, setSessionCookie, verifyPassword,
} from '../auth.js'
import { pool } from '../db.js'
import { HttpError, badRequest } from '../errors.js'
import type { AccountRole, AuthUser } from '../types.js'

const loginBody = z.object({ email: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) })

const passwordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`).max(200),
})

export const meDto = (u: AuthUser) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, department: u.department, title: u.title,
  role: u.role, isAdmin: u.isAdmin, mustChangePassword: u.mustChangePassword, teamIds: u.teamIds,
})

export async function authRoutes(app: FastifyInstance) {
  // Limite de tentativas por IP + e-mail, para dificultar a adivinhação de senhas sem
  // bloquear os demais usuários que saem pelo mesmo endereço da rede.
  const loginLimit = {
    max: 10,
    timeWindow: '1 minute',
    hook: 'preHandler' as const,
    keyGenerator: (req: FastifyRequest) => `${req.ip}:${String((req.body as { email?: unknown } | null)?.email ?? '').trim().toLowerCase()}`,
  }

  app.post('/api/auth/login', { config: { rateLimit: loginLimit } }, async (req, reply) => {
    const { email, password } = loginBody.parse(req.body)
    const { rows } = await pool.query<{
      id: string; name: string; email: string; phone: string; department: string; title: string; role: AccountRole
      is_admin: boolean; must_change_password: boolean; password_hash: string; active: boolean; team_ids: string[]
    }>(`SELECT u.*, ARRAY(SELECT ut.team_id FROM user_teams ut WHERE ut.user_id = u.id ORDER BY ut.team_id) AS team_ids
          FROM users u WHERE lower(u.email) = lower($1)`, [email])
    const row = rows[0]
    const ok = row ? await verifyPassword(password, row.password_hash) : (await burnPasswordCheck(password), false)
    if (!row || !ok || !row.active) throw new HttpError(401, 'E-mail ou senha incorretos.', 'INVALID_CREDENTIALS')

    setSessionCookie(reply, await createSession(pool, row.id))
    return {
      user: meDto({
        id: row.id, name: row.name, email: row.email, phone: row.phone, department: row.department, title: row.title,
        role: row.role, isAdmin: row.is_admin, mustChangePassword: row.must_change_password, teamIds: row.team_ids,
      }),
    }
  })

  app.post('/api/auth/logout', { preHandler: requireSession }, async (req, reply) => {
    await destroySession(pool, req.sessionHash!)
    clearSessionCookie(reply)
    return { ok: true }
  })

  app.get('/api/auth/me', { preHandler: requireSession }, async (req) => ({ user: meDto(currentUser(req)) }))

  // Limite por sessão: várias pessoas trocando a senha provisória atrás do mesmo IP não se bloqueiam.
  const passwordLimit = {
    max: 10,
    timeWindow: '1 minute',
    hook: 'preHandler' as const,
    keyGenerator: (req: FastifyRequest) => req.cookies[SESSION_COOKIE] ?? req.ip,
  }

  app.post('/api/auth/change-password', { preHandler: requireSession, config: { rateLimit: passwordLimit } }, async (req) => {
    const user = currentUser(req)
    const { currentPassword, newPassword } = passwordBody.parse(req.body)
    const stored = (await pool.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [user.id])).rows[0]
    if (!(await verifyPassword(currentPassword, stored.password_hash))) throw badRequest('A senha atual não confere.')
    if (currentPassword === newPassword) throw badRequest('A nova senha precisa ser diferente da atual.')

    await pool.query('UPDATE users SET password_hash = $2, must_change_password = false WHERE id = $1', [user.id, await hashPassword(newPassword)])
    // Qualquer outra sessão aberta com a senha antiga é encerrada.
    await destroyUserSessions(pool, user.id, req.sessionHash)
    return { user: { ...meDto(user), mustChangePassword: false } }
  })
}
