import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { FastifyRequest } from 'fastify'
import { config } from './config.js'
import { HttpError, badRequest } from './errors.js'

export interface SavedFile {
  storageKey: string
  name: string
  mimeType: string
  size: number
}

/** Extensões executáveis ou que rodam script ao serem abertas. */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'dll', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'ps1',
  'sh', 'jar', 'app', 'lnk', 'reg', 'hta', 'html', 'htm', 'xhtml', 'svg',
])

/** Tipos que o navegador pode abrir direto; os demais são sempre baixados. */
export const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'])

export const storagePath = (storageKey: string) => path.join(config.uploadDir, storageKey)

export async function ensureUploadDir() {
  await fs.mkdir(config.uploadDir, { recursive: true })
}

export async function removeFiles(files: SavedFile[]) {
  await Promise.all(files.map((f) => fs.rm(storagePath(f.storageKey), { force: true })))
}

function cleanName(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const name = path.basename(raw.replaceAll('\\', '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return name.slice(-200) || 'arquivo'
}

/**
 * Lê um formulário multipart gravando os arquivos em disco conforme chegam.
 * Em caso de erro, os arquivos já gravados são removidos.
 */
export async function readMultipart(req: FastifyRequest): Promise<{ fields: Record<string, string>; files: SavedFile[] }> {
  if (!req.isMultipart()) throw badRequest('Envie os dados como formulário multipart.')
  const fields: Record<string, string> = {}
  const files: SavedFile[] = []
  try {
    for await (const part of req.parts()) {
      if (part.type === 'field') {
        if (typeof part.value === 'string') fields[part.fieldname] = part.value
        continue
      }
      if (!part.filename) { part.file.resume(); continue }
      const name = cleanName(part.filename)
      const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
      if (BLOCKED_EXTENSIONS.has(ext)) throw badRequest(`O tipo de arquivo ".${ext}" não é permitido (${name}).`)

      const saved: SavedFile = { storageKey: randomUUID(), name, mimeType: part.mimetype || 'application/octet-stream', size: 0 }
      files.push(saved)
      await pipeline(part.file, createWriteStream(storagePath(saved.storageKey), { flags: 'wx' }))
      if (part.file.truncated) throw new HttpError(413, `O arquivo ${name} ultrapassa o limite de ${config.maxFileMb} MB.`)
      saved.size = (await fs.stat(storagePath(saved.storageKey))).size
      if (saved.size === 0) throw badRequest(`O arquivo ${name} está vazio.`)
    }
  } catch (err) {
    await removeFiles(files)
    const code = (err as { code?: string }).code
    if (code === 'FST_REQ_FILE_TOO_LARGE') throw new HttpError(413, `Cada arquivo pode ter até ${config.maxFileMb} MB.`)
    if (code === 'FST_FILES_LIMIT') throw badRequest(`Envie no máximo ${config.maxFilesPerUpload} arquivos por vez.`)
    throw err
  }
  return { fields, files }
}
