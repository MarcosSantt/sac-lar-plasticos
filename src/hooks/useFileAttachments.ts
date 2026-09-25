import { useCallback, useState } from 'react'
import type { Attachment } from '../types'
import { uid } from '../utils/format'

const MAX_PREVIEW_BYTES = 350 * 1024

function readPreview(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/') || file.size > MAX_PREVIEW_BYTES) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => resolve(undefined)
    reader.readAsDataURL(file)
  })
}

/** Converte arquivos selecionados em anexos simulados (sem upload real). */
export async function filesToAttachments(files: FileList | File[], uploadedBy: string): Promise<Attachment[]> {
  const now = new Date().toISOString()
  return Promise.all(Array.from(files).map(async (f) => ({
    id: uid('a'),
    name: f.name,
    type: f.type || 'application/octet-stream',
    size: f.size,
    uploadedBy,
    createdAt: now,
    dataUrl: await readPreview(f),
  })))
}

export function useFileAttachments(uploadedBy: string) {
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const addFiles = useCallback(async (files: FileList | File[] | null) => {
    if (!files || !files.length) return
    const list = await filesToAttachments(files, uploadedBy)
    setAttachments((cur) => [...cur, ...list.filter((a) => !cur.some((c) => c.name === a.name && c.size === a.size))])
  }, [uploadedBy])

  const remove = useCallback((id: string) => setAttachments((cur) => cur.filter((a) => a.id !== id)), [])
  const clear = useCallback(() => setAttachments([]), [])

  return { attachments, addFiles, remove, clear }
}
