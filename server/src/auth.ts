import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { config } from './config.js'
import { pool, type Db } from './db.js'
import { HttpError, forbidden } from './errors.js'
import type { AccountRole, AuthUser } from './types.js'

export const SESSION_COOKIE = 'sac_session'
export const MIN_PASSWORD_LENGTH = 8

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null
    sessionHash: string | null
  }
}

// ---------- Senhas ----------

const SCRYPT = { N: 2 ** 15, r: 8, p: 3 }
const KEY_LENGTH = 32

function derive(password: string, salt: Buffer, params: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...params, maxmem: 256 * params.N * params.r }, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

/** Formato: scrypt$N$r$p$sal$hash (os parâmetros ficam gravados para poderem ser elevados no futuro). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, SCRYPT)
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const key = await derive(password, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p) })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

/** Hash usado para gastar o mesmo tempo quando o e-mail não existe (não revela quais contas existem). */
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'))

export async function burnPasswordCheck(password: string) {
  await verifyPassword(password, await DUMMY_HASH)
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Senha provisória sem caracteres ambíguos (0/O, 1/l/I), para ser repassada ao usuário. */
export function generateTemporaryPassword(length = 12): string {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join('')
}

// ---------- Sessões ----------

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [hashToken(token), userId, config.sessionTtlHours],
  )
  return token
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionTtlHours * 3600,
  })
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' })
}

export async function destroySession(db: Db, tokenHash: string) {
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
}

/** Encerra as sessões de um usuário (troca de senha, desativação), opcionalmente preservando a atual. */
export async function destroyUserSessions(db: Db, userId: string, exceptHash: string | null = null) {
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash IS DISTINCT FROM $2', [userId, exceptHash])
}

interface SessionRow {
  id: string; name: string; email: string; phone: string; department: string; title: string
  role: AccountRole; is_admin: boolean; must_change_password: boolean; team_ids: string[]; renew: boolean
}

async function loadSession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies[SESSION_COOKIE]
  if (!token) return
  const tokenHash = hashToken(token)
  const { rows } = await pool.query<SessionRow>(
    `SELECT u.id, u.name, u.email, u.phone, u.department, u.title, u.role, u.is_admin, u.must_change_password,
            ARRAY(SELECT ut.team_id FROM user_teams ut WHERE ut.user_id = u.id ORDER BY ut.team_id) AS team_ids,
            s.last_seen_at < now() - interval '15 minutes' AS renew
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [tokenHash],
  )
  const row = rows[0]
  if (!row) return
  // Sessão deslizante: enquanto a pessoa usa o portal, o prazo é renovado.
  if (row.renew) {
    await pool.query(`UPDATE sessions SET last_seen_at = now(), expires_at = now() + make_interval(hours => $2) WHERE token_hash = $1`, [tokenHash, config.sessionTtlHours])
    setSessionCookie(reply, token)
  }
  req.sessionHash = tokenHash
  req.user = {
    id: row.id, name: row.name, email: row.email, phone: row.phone, department: row.department, title: row.title,
    role: row.role, isAdmin: row.is_admin, mustChangePassword: row.must_change_password, teamIds: row.team_ids,
  }
}

/** Exige sessão válida, mesmo que a senha provisória ainda não tenha sido trocada. */
export async function requireSession(req: FastifyRequest, reply: FastifyReply) {
  await loadSession(req, reply)
  if (!req.user) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.', 'UNAUTHENTICATED')
}

/** Exige sessão válida e senha definitiva. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  await requireSession(req, reply)
  if (req.user!.mustChangePassword) throw new HttpError(403, 'Defina uma nova senha para continuar.', 'PASSWORD_CHANGE_REQUIRED')
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply)
  if (!req.user!.isAdmin) throw forbidden('Apenas administradores podem acessar esta área.')
}

/** Usuário autenticado da requisição (as rotas protegidas sempre têm um). */
export function currentUser(req: FastifyRequest): AuthUser {
  return req.user!
}
