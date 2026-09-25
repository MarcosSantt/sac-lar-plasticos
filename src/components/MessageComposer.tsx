import { useEffect, useRef, useState } from 'react'
import { Clock, Loader2, Lock, Paperclip, Send, Smile } from 'lucide-react'
import type { Protocol } from '../types'
import { useProtocolAuthors } from '../hooks/useParticipants'
import { useStore } from '../store/StoreContext'
import { useFileAttachments } from '../hooks/useFileAttachments'
import { isClosed } from '../utils/protocol'
import { AttachmentList } from './AttachmentList'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

const EMOJIS = ['🙂', '😊', '👍', '🙏', '👏', '✅', '📎', '📦', '🚚', '💳', '📄', '⏳', '⚠️', '❗', '🎉', '🤝', '😕', '😃']

const SIMULATIONS = [
  { value: 0, label: 'Agora' },
  { value: 5, label: '+5 min' },
  { value: 15, label: '+15 min' },
  { value: 37, label: '+37 min' },
  { value: 60, label: '+1h' },
  { value: 138, label: '+2h 18min' },
]

const ROLE_LABEL = { requester: 'Solicitante', agent: 'Atendente SAC', observer: 'Observador' }

export function MessageComposer({ protocol }: { protocol: Protocol }) {
  const { sendMessage, currentUser } = useStore()
  const toast = useToast()
  const authors = useProtocolAuthors(protocol)

  const defaultAuthorId = () => {
    if (currentUser.role === 'requester' && protocol.requester.email.toLowerCase() === currentUser.email.toLowerCase()) return 'requester'
    return authors.find((a) => a.id === currentUser.id)?.id ?? authors[0].id
  }

  const [authorId, setAuthorId] = useState(defaultAuthorId)
  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [simulate, setSimulate] = useState(0)
  const [sending, setSending] = useState(false)
  const author = authors.find((a) => a.id === authorId) ?? authors[0]
  const files = useFileAttachments(author.name)
  const fileInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)

  // Ao trocar o perfil no cabeçalho, o remetente acompanha.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setAuthorId(defaultAuthorId()), [currentUser.id, protocol.id])

  const closed = isClosed(protocol.status)
  const canSend = (text.trim().length > 0 || files.attachments.length > 0) && !sending

  const send = () => {
    if (!canSend) {
      if (!sending) toast({ variant: 'error', title: 'Mensagem vazia', description: 'Escreva uma mensagem ou anexe um arquivo para enviar.' })
      return
    }
    setSending(true)
    window.setTimeout(() => {
      sendMessage(protocol.id, author, text, files.attachments.map((a) => ({ ...a, uploadedBy: author.name })), simulate)
      setText('')
      files.clear()
      setSimulate(0)
      setSending(false)
      textarea.current?.focus()
    }, 450)
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
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute left-1.5"><Avatar name={author.name} size="xs" /></span>
          <select
            value={author.id}
            onChange={(e) => setAuthorId(e.target.value)}
            className="appearance-none rounded-full border border-slate-200 bg-slate-50 py-1 pr-7 pl-9 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-brand-500 focus:outline-none"
            aria-label="Enviar como"
          >
            {authors.map((a) => <option key={a.id} value={a.id}>{a.name} — {ROLE_LABEL[a.role]}</option>)}
          </select>
          <span className="pointer-events-none absolute right-2.5 text-slate-400">▾</span>
        </div>
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

          <label className="ml-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500" title="Recurso da demonstração: registra a mensagem como se tivesse sido enviada depois de um intervalo, para mostrar o cálculo do tempo de resposta.">
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Simular horário:</span>
            <select value={simulate} onChange={(e) => setSimulate(Number(e.target.value))} className="rounded border-0 bg-transparent py-0 text-xs font-medium text-slate-700 focus:ring-0 focus:outline-none">
              {SIMULATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          <span className="ml-auto hidden text-[11px] text-slate-400 lg:inline">Ctrl + Enter para enviar</span>
          <button type="button" onClick={send} disabled={sending} className="btn-primary ml-2 px-4">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
