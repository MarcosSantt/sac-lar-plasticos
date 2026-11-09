import fs from 'node:fs'
import path from 'node:path'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyError } from 'fastify'
import { ZodError } from 'zod'
import { config } from './config.js'
import { HttpError } from './errors.js'
import { adminRoutes } from './routes/admin.js'
import { authRoutes } from './routes/auth.js'
import { protocolRoutes } from './routes/protocols.js'

export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024,
  })

  app.decorateRequest('user', null)
  app.decorateRequest('sessionHash', null)

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        // O portal pode rodar em HTTP na rede interna; não forçar o navegador a usar HTTPS.
        upgradeInsecureRequests: null,
      },
    },
  })
  await app.register(cookie)
  await app.register(rateLimit, { global: false })
  await app.register(multipart, {
    limits: { fileSize: config.maxFileMb * 1024 * 1024, files: config.maxFilesPerUpload, fields: 20, fieldSize: 200 * 1024 },
    throwFileSizeLimit: false,
  })

  app.setErrorHandler((err: FastifyError | HttpError | ZodError, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message, code: err.code })
    if (err instanceof ZodError) return reply.code(400).send({ error: err.issues[0]?.message ?? 'Dados inválidos.', code: 'VALIDATION' })
    const status = (err as FastifyError).statusCode ?? 500
    if (status === 429) return reply.code(429).send({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.', code: 'RATE_LIMITED' })
    if (status >= 500) req.log.error(err)
    return reply.code(status).send({ error: status >= 500 ? 'Erro interno. Tente novamente em instantes.' : 'Requisição inválida.' })
  })

  app.get('/api/health', async () => ({ ok: true }))
  await app.register(authRoutes)
  await app.register(protocolRoutes)
  await app.register(adminRoutes)

  const publicDir = config.publicDir
  if (publicDir && fs.existsSync(path.join(publicDir, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: publicDir,
      setHeaders(res, filePath) {
        // Os arquivos em assets/ têm hash no nome; o index.html precisa ser sempre revalidado.
        res.header('Cache-Control', filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache')
      },
    })
  }

  app.setNotFoundHandler((req, reply) => {
    const isPage = req.method === 'GET' && !req.url.startsWith('/api/') && !path.extname(req.url.split('?')[0])
    // Rotas do portal (ex.: /protocolos/SAC-2026-00001) são resolvidas pelo frontend.
    if (publicDir && isPage) return reply.header('Cache-Control', 'no-cache').sendFile('index.html')
    return reply.code(404).send({ error: 'Recurso não encontrado.' })
  })

  return app
}
