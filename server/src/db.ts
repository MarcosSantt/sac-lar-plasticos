import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { config } from './config.js'

// Colunas "date" chegam como texto AAAA-MM-DD, sem conversão de fuso horário.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v)

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 })

/** Pool ou conexão dentro de uma transação. */
export type Db = Pick<pg.Pool, 'query'>

export async function tx<T>(fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../migrations')
const MIGRATION_LOCK = 724_001

/** Aplica, em ordem, os arquivos de migrations/ que ainda não foram executados. */
export async function migrate(): Promise<string[]> {
  const client = await pool.connect()
  try {
    // Evita corrida quando duas instâncias sobem ao mesmo tempo.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK])
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    const done = new Set((await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
    const applied: string[] = []
    for (const file of files) {
      if (done.has(file)) continue
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
      applied.push(file)
    }
    return applied
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => {})
    client.release()
  }
}
