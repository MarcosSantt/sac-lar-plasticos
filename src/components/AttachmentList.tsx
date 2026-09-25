import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import type { Attachment } from '../types'
import { fileTypeLabel, formatFileSize, formatShortDateTime } from '../utils/format'
import { FileIcon } from './FileIcon'
import { Modal } from './Modal'
import { useToast } from './Toast'

interface AttachmentListProps {
  attachments: Attachment[]
  onRemove?: (id: string) => void
  variant?: 'default' | 'compact' | 'chips'
  showMeta?: boolean
}

export function AttachmentList({ attachments, onRemove, variant = 'default', showMeta = false }: AttachmentListProps) {
  const [preview, setPreview] = useState<Attachment | null>(null)
  const toast = useToast()

  const open = (a: Attachment) => {
    if (a.dataUrl) setPreview(a)
    else toast({ variant: 'info', title: 'Download simulado', description: `${a.name} — nesta demonstração os arquivos não são enviados a um servidor.` })
  }

  if (!attachments.length) return null

  return (
    <>
      {variant === 'chips' ? (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <button key={a.id} onClick={() => open(a)} className="group flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-1.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40">
              {a.dataUrl ? <img src={a.dataUrl} alt="" className="h-7 w-7 rounded-md object-cover" /> : <FileIcon name={a.name} type={a.type} size="sm" />}
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-slate-700 group-hover:text-brand-700">{a.name}</span>
                <span className="block text-[11px] text-slate-400">{formatFileSize(a.size)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <ul className={variant === 'compact' ? 'space-y-1' : 'divide-y divide-slate-100 rounded-lg border border-slate-200'}>
          {attachments.map((a) => (
            <li key={a.id} className={`group flex animate-fade-in items-center gap-3 ${variant === 'compact' ? 'rounded-md px-1 py-1.5 hover:bg-slate-50' : 'px-3 py-2.5'}`}>
              {a.dataUrl ? <img src={a.dataUrl} alt="" className={`${variant === 'compact' ? 'h-7 w-7' : 'h-9 w-9'} rounded-lg object-cover`} /> : <FileIcon name={a.name} type={a.type} size={variant === 'compact' ? 'sm' : 'md'} />}
              <button onClick={() => open(a)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-medium text-slate-800 hover:text-brand-700">{a.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {fileTypeLabel(a.name, a.type)} · {formatFileSize(a.size)}
                  {showMeta && ` · ${a.uploadedBy} · ${formatShortDateTime(a.createdAt)}`}
                </span>
              </button>
              {onRemove ? (
                <button onClick={() => onRemove(a.id)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Remover ${a.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : variant === 'default' && (
                <button onClick={() => open(a)} className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label={`Baixar ${a.name}`}>
                  <Download className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? ''} description={preview ? `${formatFileSize(preview.size)} · enviado por ${preview.uploadedBy}` : ''} size="lg">
        {preview?.dataUrl && <img src={preview.dataUrl} alt={preview.name} className="mx-auto max-h-[65vh] rounded-lg" />}
      </Modal>
    </>
  )
}
