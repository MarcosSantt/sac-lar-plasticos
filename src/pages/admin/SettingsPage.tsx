import { useState } from 'react'
import { AlertTriangle, Database, RotateCcw, Save } from 'lucide-react'
import { useStore } from '../../store/StoreContext'
import { FormField } from '../../components/FormField'
import { StatusSwitch } from '../../components/ActiveToggle'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'

export function SettingsPage() {
  const { settings, updateSettings, resetDemo, protocols, categories, observers } = useStore()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  const [confirmReset, setConfirmReset] = useState(false)
  const preview = `${form.protocolPrefix || 'SAC'}-${new Date().getFullYear()}-${String(form.nextSequence).padStart(5, '0')}`

  const save = () => {
    if (!form.companyName.trim() || !form.protocolPrefix.trim()) {
      return toast({ variant: 'error', title: 'Revise as configurações', description: 'Nome da empresa e prefixo do protocolo são obrigatórios.' })
    }
    updateSettings({ ...form, protocolPrefix: form.protocolPrefix.trim().toUpperCase() })
    toast({ variant: 'success', title: 'Configurações salvas' })
  }

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500">Parâmetros gerais do módulo de SAC.</p>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Geral</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Nome da empresa" required htmlFor="st-company">
            <input id="st-company" className="input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          </FormField>
          <FormField label="Meta de primeira resposta (minutos)" htmlFor="st-sla" hint="Usada nos indicadores de SLA do protocolo">
            <input id="st-sla" type="number" min={1} className="input" value={form.firstResponseTargetMin} onChange={(e) => setForm({ ...form, firstResponseTargetMin: Math.max(1, Number(e.target.value)) })} />
          </FormField>
          <FormField label="Prefixo do protocolo" required htmlFor="st-prefix">
            <input id="st-prefix" className="input uppercase" maxLength={6} value={form.protocolPrefix} onChange={(e) => setForm({ ...form, protocolPrefix: e.target.value })} />
          </FormField>
          <FormField label="Próximo número sequencial" htmlFor="st-seq" hint={`Próximo protocolo: ${preview}`}>
            <input id="st-seq" type="number" min={1} className="input" value={form.nextSequence} onChange={(e) => setForm({ ...form, nextSequence: Math.max(1, Number(e.target.value)) })} />
          </FormField>
          <div className="md:col-span-2">
            <span className="label">Distribuição automática</span>
            <StatusSwitch checked={form.autoAssign} onChange={(v) => setForm({ ...form, autoAssign: v })} labels={['Ativada — novos protocolos vão para o atendente com menor fila', 'Desativada — protocolos entram sem responsável']} />
          </div>
        </div>
        <div className="mt-5 flex justify-end"><button className="btn-primary" onClick={save}><Save className="h-4 w-4" /> Salvar configurações</button></div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900"><Database className="h-4 w-4 text-slate-400" />Dados da demonstração</h2>
        <p className="text-sm text-slate-500">Os dados ficam salvos no navegador (localStorage): {protocols.length} protocolos, {categories.length} categorias e {observers.length} observadores.</p>
        <button className="btn-secondary mt-4 hover:border-red-300 hover:text-red-600" onClick={() => setConfirmReset(true)}><RotateCcw className="h-4 w-4" /> Restaurar dados de exemplo</button>
      </section>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Restaurar dados de exemplo?"
        size="sm"
        footer={<>
          <button className="btn-secondary" onClick={() => setConfirmReset(false)}>Cancelar</button>
          <button className="btn-danger" onClick={() => { resetDemo(); setConfirmReset(false); window.setTimeout(() => window.location.reload(), 300); toast({ variant: 'success', title: 'Demonstração restaurada' }) }}>Restaurar</button>
        </>}
      >
        <div className="flex gap-3 text-sm text-slate-600">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <p>Protocolos, categorias, observadores e configurações criados durante a demonstração serão substituídos pelos dados originais de exemplo.</p>
        </div>
      </Modal>
    </div>
  )
}
