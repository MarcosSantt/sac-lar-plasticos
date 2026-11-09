import { useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, Building2, CheckCircle2, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ItemCosts, LookupKind, Product, Protocol, ProtocolItem, SaleType } from '../types'
import { useStore, type DetailsInput, type ItemInput } from '../store/StoreContext'
import { formatDay, formatMoney } from '../utils/format'
import { COST_LABEL, isClassified, itemTotal } from '../utils/items'
import { Modal } from './Modal'
import { FormField } from './FormField'
import { ProductPicker } from './ProductPicker'
import { SectionTitle } from './ProtocolDetails'
import { useToast } from './Toast'

const EMPTY_COSTS: ItemCosts = { product: 0, pickup: 0, shipping: 0, postal: 0 }

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <div className="mt-0.5 text-[13px] font-medium text-slate-800">{children || <span className="font-normal text-slate-400">—</span>}</div>
    </div>
  )
}

/** Opções ativas da lista, mantendo o valor atual mesmo que tenha sido desativado. */
function useOptions(kind: LookupKind, current: string) {
  const { lookups } = useStore()
  return useMemo(() => lookups.filter((l) => l.kind === kind && (l.active || l.name === current)), [lookups, kind, current])
}

function LookupSelect({ kind, label, value, onChange, required }: { kind: LookupKind; label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const options = useOptions(kind, value)
  const id = `lk-${kind}`
  return (
    <FormField label={label} htmlFor={id} required={required}>
      <select id={id} className={`input ${value ? '' : 'text-slate-400'}`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Não definido</option>
        {options.map((o) => <option key={o.id} value={o.name} className="text-slate-800">{o.name}{o.code ? ` (${o.code})` : ''}{o.active ? '' : ' — inativa'}</option>)}
      </select>
    </FormField>
  )
}

interface ItemDraft extends Omit<ItemInput, 'quantity' | 'costs'> {
  product: Product | null
  quantity: string
  costs: Record<keyof ItemCosts, string>
}

const toDraft = (i: ProtocolItem | null): ItemDraft => ({
  product: i ? { code: i.productCode, name: i.productName, family: i.family } : null,
  productCode: i?.productCode ?? '',
  quantity: String(i?.quantity ?? 1),
  description: i?.description ?? '',
  location: i?.location ?? '',
  failureMode: i?.failureMode ?? '',
  responsibleArea: i?.responsibleArea ?? '',
  machinery: i?.machinery ?? '',
  treatment: i?.treatment ?? '',
  commercialConcession: i?.commercialConcession ?? false,
  costs: Object.fromEntries(Object.entries(i?.costs ?? EMPTY_COSTS).map(([k, v]) => [k, v ? String(v) : ''])) as ItemDraft['costs'],
})

/** Aceita "12,50" ou "12.50"; vazio vale zero. */
const parseMoney = (v: string) => (v.trim() ? Number(v.replace(/\./g, '').replace(',', '.')) : 0)

function ItemModal({ protocol, item, onClose }: { protocol: Protocol; item: ProtocolItem | null | undefined; onClose: () => void }) {
  const { saveItem } = useStore()
  const toast = useToast()
  const [draft, setDraft] = useState<ItemDraft>(() => toDraft(item ?? null))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setError('') }

  const save = async () => {
    const quantity = Number(draft.quantity)
    const costs = Object.fromEntries(Object.entries(draft.costs).map(([k, v]) => [k, parseMoney(v)])) as unknown as ItemCosts
    if (!draft.product) return setError('Selecione o produto.')
    if (!Number.isInteger(quantity) || quantity < 1) return setError('Informe uma quantidade inteira maior que zero.')
    if (Object.values(costs).some((c) => !Number.isFinite(c) || c < 0)) return setError('Os custos precisam ser valores positivos, como 12,50.')
    setSaving(true)
    const { product, ...rest } = draft
    const done = await saveItem(protocol.id, item?.id ?? null, { ...rest, productCode: product.code, quantity, costs, description: draft.description.trim() })
    setSaving(false)
    if (!done) return
    toast({ variant: 'success', title: item ? 'Item atualizado' : 'Item adicionado', description: product.name })
    onClose()
  }

  const total = Object.values(draft.costs).reduce((sum, v) => sum + (parseMoney(v) || 0), 0)

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={item ? 'Classificar item' : 'Adicionar item'}
      description="A classificação alimenta o dashboard: modo de falha, área responsável, tratativa e custos."
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={saving} onClick={save}>Salvar item</button></>}
    >
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
          <FormField label="Produto" required htmlFor="it-product">
            <ProductPicker id="it-product" value={draft.product} onChange={(p) => set('product', p)} />
          </FormField>
          <FormField label="Quantidade" required htmlFor="it-qty">
            <input id="it-qty" type="number" min={1} step={1} className="input" value={draft.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </FormField>
          <FormField label="Descrição do desvio" htmlFor="it-desc" className="sm:col-span-2">
            <input id="it-desc" className="input" value={draft.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
          </FormField>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-brand-700 uppercase">Classificação</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <LookupSelect kind="failure_mode" label="Modo de falha" value={draft.failureMode} onChange={(v) => set('failureMode', v)} />
            <LookupSelect kind="area" label="Área responsável" value={draft.responsibleArea} onChange={(v) => set('responsibleArea', v)} />
            <LookupSelect kind="location" label="Local da peça" value={draft.location} onChange={(v) => set('location', v)} />
            <LookupSelect kind="machinery" label="Maquinário" value={draft.machinery} onChange={(v) => set('machinery', v)} />
            <LookupSelect kind="treatment" label="Tratativa" value={draft.treatment} onChange={(v) => set('treatment', v)} />
            <label className="flex items-center gap-2.5 self-end rounded-lg border border-slate-200 px-3 py-2.5 text-[13px] text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={draft.commercialConcession} onChange={(e) => set('commercialConcession', e.target.checked)} />
              Concessão comercial
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-brand-700 uppercase">Custos (R$)</p>
          <div className="grid gap-3 sm:grid-cols-4">
            {(Object.keys(COST_LABEL) as (keyof ItemCosts)[]).map((k) => (
              <FormField key={k} label={COST_LABEL[k]} htmlFor={`it-cost-${k}`}>
                <input id={`it-cost-${k}`} inputMode="decimal" className="input text-right tabular-nums" placeholder="0,00" value={draft.costs[k]} onChange={(e) => set('costs', { ...draft.costs, [k]: e.target.value })} />
              </FormField>
            ))}
          </div>
          <p className="mt-2 text-right text-[13px] text-slate-600">Total do item: <b className="font-semibold text-slate-900">{formatMoney(total || 0)}</b></p>
        </div>
        {error && <p className="flex items-center gap-1.5 text-[13px] text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
      </form>
    </Modal>
  )
}

function DetailsModal({ protocol, onClose }: { protocol: Protocol; onClose: () => void }) {
  const { updateDetails } = useStore()
  const toast = useToast()
  const [d, setD] = useState<DetailsInput>({
    customerName: protocol.customerName, invoiceNumber: protocol.invoiceNumber, invoiceDate: protocol.invoiceDate,
    orderNumber: protocol.orderNumber, saleType: protocol.saleType, unit: protocol.unit, returnMethod: protocol.returnMethod, returnInvoice: protocol.returnInvoice,
  })
  const [error, setError] = useState('')
  const set = <K extends keyof DetailsInput>(k: K, v: DetailsInput[K]) => { setD((x) => ({ ...x, [k]: v })); setError('') }

  const save = async () => {
    if (!d.customerName.trim()) return setError('Informe o cliente.')
    if (!d.invoiceNumber.trim()) return setError('Informe a nota fiscal.')
    if (!(await updateDetails(protocol.id, { ...d, customerName: d.customerName.trim(), invoiceNumber: d.invoiceNumber.trim() }))) return
    toast({ variant: 'success', title: 'Dados atualizados', description: protocol.protocolNumber })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Cliente e logística"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}
    >
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save() }}>
        <FormField label="Cliente (razão social)" required htmlFor="dt-customer" className="sm:col-span-2">
          <input id="dt-customer" className="input" value={d.customerName} onChange={(e) => set('customerName', e.target.value)} maxLength={200} />
        </FormField>
        <FormField label="Nota fiscal" required htmlFor="dt-nf"><input id="dt-nf" className="input" value={d.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} maxLength={40} /></FormField>
        <FormField label="Emissão da NF" htmlFor="dt-nfdate"><input id="dt-nfdate" type="date" className="input" value={d.invoiceDate ?? ''} onChange={(e) => set('invoiceDate', e.target.value || null)} /></FormField>
        <FormField label="Nº do pedido" htmlFor="dt-order"><input id="dt-order" className="input" value={d.orderNumber} onChange={(e) => set('orderNumber', e.target.value)} maxLength={40} /></FormField>
        <FormField label="Tipo de venda" htmlFor="dt-type">
          <select id="dt-type" className="input" value={d.saleType} onChange={(e) => set('saleType', e.target.value as SaleType)}><option>B2B</option><option>B2C</option></select>
        </FormField>
        <LookupSelect kind="unit" label="Unidade" value={d.unit} onChange={(v) => set('unit', v)} />
        <LookupSelect kind="return_method" label="Logística de retorno (pós)" value={d.returnMethod} onChange={(v) => set('returnMethod', v)} />
        <FormField label="NF de devolução (NFD)" htmlFor="dt-nfd"><input id="dt-nfd" className="input" value={d.returnInvoice} onChange={(e) => set('returnInvoice', e.target.value)} maxLength={40} /></FormField>
        {error && <p className="flex items-center gap-1.5 text-[13px] text-red-600 sm:col-span-2"><AlertCircle className="h-4 w-4" />{error}</p>}
      </form>
    </Modal>
  )
}

/** Aba "Itens": dados da venda e os itens reclamados, com a classificação feita pelo SAC. */
export function ProtocolItems({ protocol, canManage }: { protocol: Protocol; canManage: boolean }) {
  const { removeItem } = useStore()
  const toast = useToast()
  // undefined = fechado · null = novo item · item = edição
  const [editing, setEditing] = useState<ProtocolItem | null | undefined>(undefined)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [removing, setRemoving] = useState<ProtocolItem | null>(null)
  const total = protocol.items.reduce((sum, i) => sum + itemTotal(i.costs), 0)
  const pending = protocol.items.filter((i) => !isClassified(i)).length

  const confirmRemove = async () => {
    if (!removing) return
    const item = removing
    setRemoving(null)
    if (await removeItem(protocol.id, item.id)) toast({ variant: 'info', title: 'Item removido', description: item.productName })
  }

  return (
    <div className="animate-fade-in space-y-6 p-5 sm:p-6">
      <div>
        <div className="flex items-center justify-between">
          <SectionTitle icon={<Building2 className="h-3.5 w-3.5" />}>Cliente e logística</SectionTitle>
          {canManage && <button className="btn-ghost -mt-3 px-2.5 py-1.5 text-xs" onClick={() => setDetailsOpen(true)}><Pencil className="h-3.5 w-3.5" /> Editar</button>}
        </div>
        <div className="grid gap-x-6 gap-y-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><Field label="Cliente">{protocol.customerName}</Field></div>
          <Field label="Nota fiscal">{protocol.invoiceNumber}</Field>
          <Field label="Emissão da NF">{protocol.invoiceDate ? formatDay(protocol.invoiceDate) : ''}</Field>
          <Field label="Pedido">{protocol.orderNumber}</Field>
          <Field label="Tipo">{protocol.saleType}</Field>
          <Field label="Unidade">{protocol.unit}</Field>
          <Field label="Logística de retorno">{protocol.returnMethod}</Field>
          <Field label="NFD">{protocol.returnInvoice}</Field>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={<Package className="h-3.5 w-3.5" />} count={protocol.items.length}>Itens reclamados</SectionTitle>
          <div className="-mt-3 flex items-center gap-3">
            {pending > 0 && <span className="flex items-center gap-1 text-xs font-medium text-amber-800"><AlertCircle className="h-3.5 w-3.5" />{pending} sem classificação</span>}
            {canManage && <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setEditing(null)}><Plus className="h-3.5 w-3.5" /> Adicionar item</button>}
          </div>
        </div>
        <ul className="space-y-3">
          {protocol.items.map((item, index) => {
            const classified = isClassified(item)
            return (
              <li key={item.id} className={`rounded-lg border p-4 ${classified ? 'border-slate-200' : 'border-amber-500/40 bg-amber-50/40'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Item {index + 1}</p>
                    <p className="font-medium text-slate-900">{item.quantity} × {item.productName}</p>
                    <p className="text-xs text-slate-500">Cód. {item.productCode}{item.family && ` · ${item.family}`}</p>
                    {item.description && <p className="mt-1 text-[13px] text-slate-600">{item.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {classified
                      ? <span className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"><CheckCircle2 className="h-3.5 w-3.5" />Classificado</span>
                      : <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"><AlertCircle className="h-3.5 w-3.5" />Aguardando o SAC</span>}
                    {canManage && (
                      <>
                        <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setEditing(item)}><Pencil className="h-3.5 w-3.5" /> {classified ? 'Editar' : 'Classificar'}</button>
                        {protocol.items.length > 1 && (
                          <button className="btn-ghost px-2 py-1.5 text-xs hover:bg-red-50 hover:text-red-600" onClick={() => setRemoving(item)} aria-label={`Remover item ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {(classified || item.failureMode || item.responsibleArea || item.treatment) && (
                  <div className="mt-3 grid gap-x-6 gap-y-2 border-t border-slate-100 pt-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Field label="Modo de falha">{item.failureMode}</Field>
                    <Field label="Área responsável">{item.responsibleArea}{item.areaCode && <span className="block text-[11px] font-normal text-slate-500">CR {item.areaCode}</span>}</Field>
                    <Field label="Local">{item.location}</Field>
                    <Field label="Maquinário">{item.machinery}</Field>
                    <Field label="Tratativa">{item.treatment}{item.commercialConcession && <span className="block text-[11px] font-normal text-slate-500">Concessão comercial</span>}</Field>
                    <Field label="Custo">{itemTotal(item.costs) ? formatMoney(itemTotal(item.costs)) : ''}</Field>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {total > 0 && <p className="mt-3 text-right text-[13px] text-slate-600">Custo total do protocolo: <b className="font-semibold text-slate-900">{formatMoney(total)}</b></p>}
      </div>

      {editing !== undefined && <ItemModal protocol={protocol} item={editing} onClose={() => setEditing(undefined)} />}
      {detailsOpen && <DetailsModal protocol={protocol} onClose={() => setDetailsOpen(false)} />}
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remover item?"
        size="sm"
        footer={<><button className="btn-secondary" onClick={() => setRemoving(null)}>Cancelar</button><button className="btn-danger" onClick={confirmRemove}>Remover</button></>}
      >
        <p className="text-sm text-slate-600">O item <b className="font-semibold text-slate-900">{removing?.quantity} × {removing?.productName}</b> sai do protocolo e dos indicadores. A remoção fica registrada no histórico.</p>
      </Modal>
    </div>
  )
}
