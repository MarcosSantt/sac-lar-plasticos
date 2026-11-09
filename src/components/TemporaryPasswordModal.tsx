import { useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { Modal } from './Modal'

export interface TemporaryPassword { name: string; email: string; password: string }

/** Mostra, uma única vez, a senha provisória de uma conta criada ou redefinida. */
export function TemporaryPasswordModal({ value, onClose }: { value: TemporaryPassword | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const close = () => { setCopied(false); onClose() }

  const copy = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value.password)
      setCopied(true)
    } catch { /* sem acesso à área de transferência: a senha continua visível para cópia manual */ }
  }

  return (
    <Modal open={!!value} onClose={close} title="Senha provisória" size="sm" footer={<button className="btn-primary" onClick={close}>Concluir</button>}>
      {value && (
        <div className="text-sm text-slate-600">
          <p>Repasse esta senha a <b className="font-semibold text-slate-900">{value.name}</b> ({value.email}). No primeiro acesso será exigida a criação de uma senha pessoal.</p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5">
            <KeyRound className="h-4 w-4 shrink-0 text-brand-600" />
            <code className="flex-1 font-mono text-base font-semibold tracking-wide text-brand-800 select-all">{value.password}</code>
            <button onClick={copy} className="btn-ghost px-2.5 py-1.5 text-xs">
              {copied ? <><Check className="h-3.5 w-3.5" /> Copiada</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Por segurança, esta senha não será exibida novamente. Se for perdida, use "Redefinir senha".</p>
        </div>
      )}
    </Modal>
  )
}
