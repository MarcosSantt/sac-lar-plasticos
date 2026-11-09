import { Loader2 } from 'lucide-react'
import { asset } from '../utils/asset'

export function SplashScreen({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <img src={asset('logo-lar.png')} alt="Lar Plásticos" className="h-10 w-auto" />
      {error ? (
        <>
          <p className="text-sm text-slate-600">{error}</p>
          <button className="btn-primary" onClick={onRetry}>Tentar novamente</button>
        </>
      ) : (
        <Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-label="Carregando" />
      )}
    </div>
  )
}
