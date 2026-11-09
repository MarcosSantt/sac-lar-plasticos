import path from 'node:path'

// Em desenvolvimento as variáveis vêm de server/.env; em produção, do ambiente do contêiner.
try { process.loadEnvFile() } catch { /* sem arquivo .env */ }

const env = process.env

function required(name: string): string {
  const value = env[name]
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  return value
}

export const config = {
  port: Number(env.PORT ?? 3001),
  host: env.HOST ?? '0.0.0.0',
  databaseUrl: required('DATABASE_URL'),
  uploadDir: path.resolve(env.UPLOAD_DIR ?? './uploads'),
  /** Pasta com o build do frontend; quando definida, a API também serve o site. */
  publicDir: env.PUBLIC_DIR ? path.resolve(env.PUBLIC_DIR) : null,
  /** Ative quando o portal estiver atrás de HTTPS. */
  cookieSecure: env.COOKIE_SECURE === 'true',
  /** Ative quando houver um proxy reverso na frente (para registrar o IP real). */
  trustProxy: env.TRUST_PROXY === 'true',
  sessionTtlHours: Number(env.SESSION_TTL_HOURS ?? 12),
  maxFileMb: Number(env.MAX_FILE_MB ?? 10),
  maxFilesPerUpload: 10,
  /** Administrador criado na primeira inicialização, quando ainda não existe nenhum usuário. */
  admin: {
    name: env.ADMIN_NAME ?? 'Administrador',
    email: env.ADMIN_EMAIL ?? '',
    password: env.ADMIN_PASSWORD ?? '',
  },
}
