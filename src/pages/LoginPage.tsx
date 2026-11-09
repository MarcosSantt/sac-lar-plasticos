import { useState, type FormEvent } from 'react'
import { AlertCircle, Loader2, LogIn } from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { FormField } from '../components/FormField'

export function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!email.trim() || !password) return setError('Informe seu e-mail e sua senha.')
    setError('')
    setLoading(true)
    try {
      await onLogin(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Entrar no portal" description="Use o e-mail e a senha cadastrados pela equipe SAC.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <FormField label="E-mail" htmlFor="login-email">
          <input id="login-email" type="email" autoComplete="username" autoFocus className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@larplasticos.com.br" />
        </FormField>
        <FormField label="Senha" htmlFor="login-password">
          <input id="login-password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        {error && (
          <p role="alert" className="flex animate-fade-in items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Entrar
        </button>
        <p className="text-center text-xs text-slate-500">Esqueceu a senha? Peça a um administrador do portal para redefini-la.</p>
      </form>
    </AuthShell>
  )
}
