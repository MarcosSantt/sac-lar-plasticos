import { useCallback, useEffect, useRef, useState } from 'react'
import type { Attachment } from '../types'
import { useToast } from '../components/Toast'
import { uid } from '../utils/format'

export const MAX_FILE_MB = 10
export const MAX_FILES = 10

/** Arquivo selecionado que ainda não foi enviado ao servidor. */
interface PendingFile { attachment: Attachment; file: File }

/** Arquivos escolhidos em um formulário, enviados junto com ele. */
export function useFileAttachments(uploadedBy: string) {
  const [pending, setPending] = useState<PendingFile[]>([])
  const toast = useToast()
  const previews = useRef(new Set<string>())

  // Libera as pré-visualizações ao sair da tela.
  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  const addFiles = useCallback((files: FileList | File[] | null) => {
    if (!files || !files.length) return
    const now = new Date().toISOString()
    const tooBig = Array.from(files).filter((f) => f.size > MAX_FILE_MB * 1024 * 1024)
    if (tooBig.length) {
      toast({ variant: 'error', title: 'Arquivo muito grande', description: `${tooBig.map((f) => f.name).join(', ')} ultrapassa o limite de ${MAX_FILE_MB} MB.` })
    }
    const accepted = Array.from(files).filter((f) => !tooBig.includes(f)).map((file) => {
      const url = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      if (url) previews.current.add(url)
      return { file, attachment: { id: uid('a'), name: file.name, type: file.type || 'application/octet-stream', size: file.size, uploadedBy, createdAt: now, url } }
    })
    setPending((cur) => {
      const merged = [...cur, ...accepted.filter((a) => !cur.some((c) => c.file.name === a.file.name && c.file.size === a.file.size))]
      if (merged.length > MAX_FILES) toast({ variant: 'error', title: 'Muitos arquivos', description: `Envie no máximo ${MAX_FILES} arquivos por vez.` })
      return merged.slice(0, MAX_FILES)
    })
  }, [uploadedBy, toast])

  const remove = useCallback((id: string) => setPending((cur) => cur.filter((p) => p.attachment.id !== id)), [])
  const clear = useCallback(() => setPending([]), [])

  return { attachments: pending.map((p) => p.attachment), files: pending.map((p) => p.file), addFiles, remove, clear }
}
