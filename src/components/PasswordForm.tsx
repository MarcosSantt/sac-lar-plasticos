import { useState, type FormEvent, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { FormField } from './FormField'

export const MIN_PASSWORD_LENGTH = 8

interface PasswordFormProps {
  currentLabel?: string
  submitLabel: string
  onSubmit: (currentPassword: string, newPassword: string) => Promise<boolean>
  /** Botões extras ao lado do envio (ex.: Cancelar). */
  secondary?: ReactNode
}

/** Campos de troca de senha, usados no primeiro acesso e no menu do usuário. */
export function PasswordForm({ currentLabel = 'Senha atual', submitLabel, onSubmit, secondary }: PasswordFormProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [saving, setSaving] = useState(false)

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const e: typeof errors = {}
    if (!current) e.current = 'Informe a senha atual.'
    if (next.length < MIN_PASSWORD_LENGTH) e.next = `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
    else if (next === current) e.next = 'A nova senha precisa ser diferente da atual.'
    if (confirm !== next) e.confirm = 'As senhas não conferem.'
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    const done = await onSubmit(current, next)
    if (!done) setSaving(false)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormField label={currentLabel} required error={errors.current} htmlFor="pw-current">
        <input id="pw-current" type="password" autoComplete="current-password" autoFocus className={`input ${errors.current ? 'input-error' : ''}`} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </FormField>
      <FormField label="Nova senha" required error={errors.next} hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`} htmlFor="pw-next">
        <input id="pw-next" type="password" autoComplete="new-password" className={`input ${errors.next ? 'input-error' : ''}`} value={next} onChange={(e) => setNext(e.target.value)} />
      </FormField>
      <FormField label="Confirmar nova senha" required error={errors.confirm} htmlFor="pw-confirm">
        <input id="pw-confirm" type="password" autoComplete="new-password" className={`input ${errors.confirm ? 'input-error' : ''}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </FormField>
      <div className="flex justify-end gap-2 pt-1">
        {secondary}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
        </button>
      </div>
    </form>
  )
}
