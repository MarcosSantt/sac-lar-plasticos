import { hashPassword } from './auth.js'
import { buildApp } from './app.js'
import { config } from './config.js'
import { migrate, pool } from './db.js'
import { ensureUploadDir } from './uploads.js'

/** Na primeira inicialização, cria o administrador definido nas variáveis de ambiente. */
async function ensureFirstAdmin(log: { info: (msg: string) => void; warn: (msg: string) => void }) {
  const { rows } = await pool.query<{ count: string }>('SELECT count(*) FROM users')
  if (Number(rows[0].count) > 0) return
  const { name, email, password } = config.admin
  if (!email || !password) {
    log.warn('Nenhum usuário cadastrado. Defina ADMIN_EMAIL e ADMIN_PASSWORD e reinicie para criar o primeiro administrador.')
    return
  }
  await pool.query(
    `INSERT INTO users (name, email, department, title, role, is_admin, password_hash)
     VALUES ($1, $2, 'SAC', 'Administrador', 'agent', true, $3)`,
    [name, email, await hashPassword(password)],
  )
  log.info(`Administrador inicial criado: ${email} (a senha deverá ser trocada no primeiro acesso).`)
}

const app = await buildApp()

const applied = await migrate()
if (applied.length) app.log.info(`Migrações aplicadas: ${applied.join(', ')}`)
await ensureUploadDir()
await ensureFirstAdmin(app.log)

// Limpeza periódica das sessões vencidas.
const cleanup = setInterval(() => {
  pool.query('DELETE FROM sessions WHERE expires_at < now()').catch((err) => app.log.error(err))
}, 60 * 60 * 1000)
cleanup.unref()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close()
    await pool.end()
    process.exit(0)
  })
}

await app.listen({ port: config.port, host: config.host })
