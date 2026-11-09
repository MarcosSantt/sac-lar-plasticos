import { AuthShell } from '../components/AuthShell'
import { PasswordForm } from '../components/PasswordForm'

interface Props {
  name: string
  onSubmit: (currentPassword: string, newPassword: string) => Promise<boolean>
  onLogout: () => void
}

/** Primeiro acesso (ou senha redefinida): a senha provisória precisa ser trocada antes de continuar. */
export function ChangePasswordPage({ name, onSubmit, onLogout }: Props) {
  return (
    <AuthShell title={`Olá, ${name.split(' ')[0]}! Crie sua senha`} description="Sua senha atual é provisória. Defina uma senha pessoal para acessar o portal.">
      <PasswordForm
        currentLabel="Senha provisória"
        submitLabel="Salvar e entrar"
        onSubmit={onSubmit}
        secondary={<button type="button" className="btn-secondary" onClick={onLogout}>Sair</button>}
      />
    </AuthShell>
  )
}
