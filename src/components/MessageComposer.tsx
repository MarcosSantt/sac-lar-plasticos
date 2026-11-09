import { useRef, useState } from 'react'
import { Loader2, Lock, Paperclip, Send, Smile } from 'lucide-react'
import type { Protocol } from '../types'
import { useStore } from '../store/StoreContext'
import { useFileAttachments } from '../hooks/useFileAttachments'
import { isClosed, roleInProtocol } from '../utils/protocol'
import { AttachmentList } from './AttachmentList'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

const EMOJIS = ['🙂', '😊', '👍', '🙏', '👏', '✅', '📎', '📦', '🚚', '💳', '📄', '⏳', '⚠️', '❗', '🎉', '🤝', '😕', '😃']

const ROLE_LABEL = { requester: 'Solicitante', agent: 'Atendente SAC', observer: 'Observador', coordinator: 'Coordenador', post_sales: 'Pós-vendas' }

export function MessageComposer({ protocol }: { protocol: Protocol }) {
  const { sendMessage, currentUser } = useStore()
  const toast = useToast()
  const role = roleInProtocol(protocol, currentUser)

  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const files = useFileAttachments(currentUser.name)
  const fileInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)

  const closed = isClosed(protocol.status)
  const canSend = (text.trim().length > 0 || files.attachments.length > 0) && !sending

  const send = async () => {
    if (!canSend) {
      if (!sending) toast({ variant: 'error', title: 'Mensagem vazia', description: 'Escreva uma mensagem ou anexe um arquivo para enviar.' })
      return
    }
    setSending(true)
    const sent = await sendMessage(protocol.id, text.trim(), files.files)
    setSending(false)
    // Em caso de falha o texto e os anexos ficam no lugar para uma nova tentativa.
    if (!sent) return
    setText('')
    files.clear()
    textarea.current?.focus()
  }

  const insertEmoji = (e: string) => {
    const el = textarea.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setText(text.slice(0, start) + e + text.slice(end))
    setEmojiOpen(false)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + e.length, start + e.length) })
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
      {closed && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Lock className="h-3.5 w-3.5" /> Este protocolo está encerrado. Uma nova mensagem continua sendo registrada no histórico.
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Respondendo como</span>
        <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pr-3 pl-1.5 font-medium text-slate-700">
          <Avatar name={currentUser.name} size="xs" />{currentUser.name} — {ROLE_LABEL[role]}
        </span>
      </div>

      <div className="rounded-xl border border-slate-300 bg-white transition focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/15">
        <textarea
          ref={textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() } }}
          rows={3}
          placeholder="Escreva sua mensagem..."
          className="block w-full resize-none rounded-t-xl bg-transparent px-3.5 pt-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
        {files.attachments.length > 0 && (
          <div className="px-3 pt-1 pb-2"><AttachmentList attachments={files.attachments} onRemove={files.remove} variant="compact" /></div>
        )}
        <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 px-2 py-1.5">
          <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost px-2.5 py-1.5 text-[13px]" title="Anexar arquivo">
            <Paperclip className="h-4 w-4" /> <span className="hidden sm:inline">Anexar arquivo</span>
          </button>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { files.addFiles(e.target.files); e.target.value = '' }} />

          <div className="relative">
            <button type="button" onClick={() => setEmojiOpen((o) => !o)} className="btn-ghost px-2.5 py-1.5 text-[13px]" title="Emoji">
              <Smile className="h-4 w-4" /> <span className="hidden sm:inline">Emoji</span>
            </button>
            {emojiOpen && (
              <div className="absolute bottom-10 left-0 z-20 grid w-56 animate-pop-in grid-cols-6 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => insertEmoji(e)} className="rounded-md p-1 text-lg hover:bg-slate-100">{e}</button>
                ))}
              </div>
            )}
          </div>

          <span className="ml-auto hidden text-[11px] text-slate-400 lg:inline">Ctrl + Enter para enviar</span>
          <button type="button" onClick={send} disabled={sending} className="btn-primary ml-2 px-4">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
