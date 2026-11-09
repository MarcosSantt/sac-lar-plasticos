import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, Eye, FileText, Info, Loader2, Package, Paperclip, Plus, Send, Trash2, User } from 'lucide-react'
import { useStore } from '../store/StoreContext'
import { useFileAttachments } from '../hooks/useFileAttachments'
import type { Priority, Product, Protocol, RequestType, SaleType } from '../types'
import { ProductPicker } from '../components/ProductPicker'
import { PageHeader } from '../components/PageHeader'
import { FormField } from '../components/FormField'
import { ParticipantSelector } from '../components/ParticipantSelector'
import { FileDropzone } from '../components/FileDropzone'
import { AttachmentList } from '../components/AttachmentList'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { PRIORITY_META, PRIORITY_ORDER, REQUEST_TYPES } from '../utils/protocol'
import { asset } from '../utils/asset'

interface FormState {
  name: string
  email: string
  phone: string
  type: RequestType
  categoryId: string
  title: string
  priority: Priority | ''
  location: string
  description: string
  teamId: string
  customerName: string
  invoiceNumber: string
  invoiceDate: string
  orderNumber: string
  saleType: SaleType
}

type Errors = Partial<Record<keyof FormState | 'items', string>>

interface ItemDraft { key: number; product: Product | null; quantity: string; description: string }
type ItemErrors = Record<number, { product?: string; quantity?: string }>

let nextItemKey = 1
const newItem = (): ItemDraft => ({ key: nextItemKey++, product: null, quantity: '1', description: '' })

const PRIORITY_HINT: Record<Priority, string> = {
  baixa: 'Sem impacto imediato',
  media: 'Impacto moderado',
  alta: 'Impacta a operação do cliente',
  urgente: 'Requer ação imediata',
}

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-[13px] text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function NewProtocolPage() {
  const { categories, observers, teams, currentUser, createProtocol } = useStore()
  // O vendedor abre sempre na própria equipe; o pós-vendas escolhe entre as que acompanha.
  const choosesTeam = currentUser.role === 'post_sales'
  const myTeams = useMemo(() => teams.filter((t) => t.active && currentUser.teamIds.includes(t.id)), [teams, currentUser.teamIds])
  const navigate = useNavigate()
  const toast = useToast()
  // Quem abre o protocolo não pode se colocar como observador dele.
  const selectableObservers = useMemo(() => observers.filter((o) => o.id !== currentUser.id), [observers, currentUser.id])

  // Vem preenchido com os dados de quem está logado, mas pode ser ajustado
  // quando o protocolo é registrado em nome de outra pessoa.
  const initial: FormState = {
    name: currentUser.name,
    email: currentUser.email,
    phone: currentUser.phone,
    type: 'Solicitação', categoryId: '', title: '', priority: '', location: '', description: '',
    teamId: choosesTeam && myTeams.length === 1 ? myTeams[0].id : '',
    customerName: '', invoiceNumber: '', invoiceDate: '', orderNumber: '', saleType: 'B2B',
  }
  const [form, setForm] = useState<FormState>(initial)
  const [observerIds, setObserverIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [items, setItems] = useState<ItemDraft[]>(() => [newItem()])
  const [itemErrors, setItemErrors] = useState<ItemErrors>({})
  const setItem = (key: number, patch: Partial<ItemDraft>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))
    if (itemErrors[key]) setItemErrors((e) => ({ ...e, [key]: {} }))
  }
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<Protocol | null>(null)
  const files = useFileAttachments(form.name || currentUser.name)
  const formRef = useRef<HTMLFormElement>(null)

  const activeCategories = useMemo(() => categories.filter((c) => c.active), [categories])
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const validateItems = (): ItemErrors => {
    const e: ItemErrors = {}
    for (const i of items) {
      const q = Number(i.quantity)
      const err = { product: i.product ? undefined : 'Selecione o produto.', quantity: Number.isInteger(q) && q > 0 ? undefined : 'Quantidade inválida.' }
      if (err.product || err.quantity) e[i.key] = err
    }
    return e
  }

  const validate = (): Errors => {
    const e: Errors = {}
    if (!form.customerName.trim()) e.customerName = 'Informe o cliente (razão social).'
    if (!form.invoiceNumber.trim()) e.invoiceNumber = 'Informe o número da nota fiscal.'
    if (!form.name.trim()) e.name = 'Informe o nome do solicitante.'
    if (!form.email.trim()) e.email = 'Informe um e-mail para receber as atualizações.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Este e-mail parece incompleto. Confira, por favor.'
    if (choosesTeam && !form.teamId) e.teamId = 'Selecione a equipe deste protocolo.'
    if (!form.categoryId) e.categoryId = 'Selecione uma categoria para continuar.'
    if (!form.title.trim()) e.title = 'Dê um título curto que resuma a solicitação.'
    if (!form.priority) e.priority = 'Escolha a prioridade do atendimento.'
    if (form.description.trim().length < 15) e.description = 'Descreva a solicitação com um pouco mais de detalhes (mínimo de 15 caracteres).'
    return e
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const e = validate()
    const ie = validateItems()
    setErrors(e)
    setItemErrors(ie)
    const problems = Object.keys(e).length + Object.keys(ie).length
    if (problems) {
      toast({ variant: 'error', title: 'Revise os campos destacados', description: `${problems} campo(s) precisam de atenção antes de abrir o protocolo.` })
      const firstItem = items.find((i) => ie[i.key])
      const first = formRef.current?.querySelector(Object.keys(e).length ? `[name="${Object.keys(e)[0]}"]` : `[name="item-${firstItem?.key}"]`) as HTMLElement | null
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      first?.focus({ preventScroll: true })
      return
    }
    setSubmitting(true)
    const p = await createProtocol({
      requester: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
      type: form.type,
      categoryId: form.categoryId,
      title: form.title.trim(),
      priority: form.priority as Priority,
      location: form.location.trim(),
      description: form.description.trim(),
      observerIds,
      teamId: choosesTeam ? form.teamId : undefined,
      customerName: form.customerName.trim(),
      invoiceNumber: form.invoiceNumber.trim(),
      invoiceDate: form.invoiceDate || null,
      orderNumber: form.orderNumber.trim(),
      saleType: form.saleType,
      items: items.map((i) => ({ productCode: i.product!.code, quantity: Number(i.quantity), description: i.description.trim() })),
    }, files.files)
    setSubmitting(false)
    if (p) setCreated(p)
  }

  const resetForm = () => {
    setForm(initial)
    setItems([newItem()])
    setItemErrors({})
    setObserverIds([])
    files.clear()
    setErrors({})
    setCreated(null)
  }

  const err = (k: keyof FormState) => (errors[k] ? 'input-error' : '')

  return (
    <div className="animate-slide-up">
      <PageHeader
        crumbs={[{ label: 'Início', to: '/' }, { label: 'Abrir SAC' }]}
        title="Novo protocolo de SAC"
        description="Registre sua solicitação e acompanhe todo o atendimento em um único lugar."
      />

      <form ref={formRef} onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Section icon={<Building2 className="h-4 w-4" />} title="Cliente e nota fiscal" description="Dados da venda em que ocorreu o problema.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Cliente (razão social)" required error={errors.customerName} htmlFor="customerName" className="sm:col-span-2 lg:col-span-3">
                <input id="customerName" name="customerName" className={`input ${err('customerName')}`} value={form.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="Ex.: KMI PLASTICOS" maxLength={200} />
              </FormField>
              <FormField label="Tipo de venda" required htmlFor="saleType">
                <select id="saleType" name="saleType" className="input" value={form.saleType} onChange={(e) => set('saleType', e.target.value as SaleType)}>
                  <option value="B2B">B2B</option>
                  <option value="B2C">B2C</option>
                </select>
              </FormField>
              <FormField label="Nota fiscal" required error={errors.invoiceNumber} htmlFor="invoiceNumber">
                <input id="invoiceNumber" name="invoiceNumber" className={`input ${err('invoiceNumber')}`} value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} placeholder="Nº da NF" maxLength={40} />
              </FormField>
              <FormField label="Emissão da NF" htmlFor="invoiceDate" hint="Opcional">
                <input id="invoiceDate" name="invoiceDate" type="date" className="input" value={form.invoiceDate} onChange={(e) => set('invoiceDate', e.target.value)} />
              </FormField>
              <FormField label="Nº do pedido" htmlFor="orderNumber" hint="Opcional">
                <input id="orderNumber" name="orderNumber" className="input" value={form.orderNumber} onChange={(e) => set('orderNumber', e.target.value)} maxLength={40} />
              </FormField>
            </div>
          </Section>

          <Section icon={<Package className="h-4 w-4" />} title="Itens reclamados" description="Um item por produto. Cada item recebe a própria tratativa do SAC (ex.: um bonificado e outro em concessão).">
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={item.key} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Item {index + 1}</span>
                    {items.length > 1 && (
                      <button type="button" className="btn-ghost px-2 py-1 text-xs hover:bg-red-50 hover:text-red-600" onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))}>
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                    <FormField label="Produto" required error={itemErrors[item.key]?.product} htmlFor={`item-${item.key}`}>
                      <ProductPicker id={`item-${item.key}`} name={`item-${item.key}`} value={item.product} onChange={(p) => setItem(item.key, { product: p })} invalid={!!itemErrors[item.key]?.product} />
                    </FormField>
                    <FormField label="Quantidade" required error={itemErrors[item.key]?.quantity} htmlFor={`qty-${item.key}`}>
                      <input id={`qty-${item.key}`} type="number" min={1} step={1} className={`input ${itemErrors[item.key]?.quantity ? 'input-error' : ''}`} value={item.quantity} onChange={(e) => setItem(item.key, { quantity: e.target.value })} />
                    </FormField>
                    <FormField label="O que aconteceu com este item" htmlFor={`desc-${item.key}`} className="sm:col-span-2" hint="Ex.: tampa quebrada na lateral, faltou o pedal">
                      <input id={`desc-${item.key}`} className="input" value={item.description} onChange={(e) => setItem(item.key, { description: e.target.value })} maxLength={2000} />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setItems((l) => [...l, newItem()])} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-[13px] font-medium text-brand-600 transition hover:border-brand-400 hover:bg-brand-50/50">
              <Plus className="h-4 w-4" /> Adicionar item
            </button>
          </Section>

          <Section icon={<User className="h-4 w-4" />} title="Contato para retorno" description="Quem recebe as atualizações deste atendimento.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Nome" required error={errors.name} htmlFor="name">
                <input id="name" name="name" className={`input ${err('name')}`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nome completo" />
              </FormField>
              <FormField label="E-mail" required error={errors.email} htmlFor="email">
                <input id="email" name="email" type="email" className={`input ${err('email')}`} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="nome@empresa.com.br" />
              </FormField>
              <FormField label="Telefone" htmlFor="phone" hint="Opcional">
                <input id="phone" name="phone" className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 99999-9999" />
              </FormField>
            </div>
          </Section>

          <Section icon={<FileText className="h-4 w-4" />} title="Informações da solicitação" description="Quanto mais detalhes, mais rápido conseguimos resolver.">
            <div className="grid gap-4 sm:grid-cols-2">
              {choosesTeam && (
                <FormField label="Equipe" required error={errors.teamId} htmlFor="teamId" hint="O coordenador da equipe escolhida acompanha este protocolo" className="sm:col-span-2">
                  <select id="teamId" name="teamId" className={`input ${err('teamId')} ${form.teamId ? '' : 'text-slate-400'}`} value={form.teamId} onChange={(e) => set('teamId', e.target.value)}>
                    <option value="">Selecione a equipe</option>
                    {myTeams.map((t) => <option key={t.id} value={t.id} className="text-slate-800">{t.name}</option>)}
                  </select>
                </FormField>
              )}
              <FormField label="Tipo de solicitação" required htmlFor="type">
                <select id="type" name="type" className="input" value={form.type} onChange={(e) => set('type', e.target.value as RequestType)}>
                  {REQUEST_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Categoria" required error={errors.categoryId} htmlFor="categoryId" hint="Categorias gerenciadas em Administração › Categorias">
                <select id="categoryId" name="categoryId" className={`input ${err('categoryId')} ${form.categoryId ? '' : 'text-slate-400'}`} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">Selecione uma categoria</option>
                  {activeCategories.map((c) => <option key={c.id} value={c.id} className="text-slate-800">{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Assunto / Título" required error={errors.title} htmlFor="title" className="sm:col-span-2">
                <input id="title" name="title" className={`input ${err('title')}`} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex.: Produto chegou com avaria na embalagem" maxLength={120} />
              </FormField>

              <div className="sm:col-span-2">
                <span className="label">Prioridade <span className="text-red-500">*</span></span>
                <div role="radiogroup" className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {PRIORITY_ORDER.map((p) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={form.priority === p}
                      name={p === 'baixa' ? 'priority' : undefined}
                      key={p}
                      onClick={() => set('priority', p)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-all ${
                        form.priority === p ? 'border-brand-400 bg-brand-50/70 ring-1 ring-brand-300' : errors.priority ? 'border-red-300 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
                        <span className={`h-2 w-2 rounded-full ${PRIORITY_META[p].bar}`} />{PRIORITY_META[p].label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{PRIORITY_HINT[p]}</span>
                    </button>
                  ))}
                </div>
                {errors.priority && <p className="mt-1.5 animate-fade-in text-xs text-red-600">{errors.priority}</p>}
              </div>

              <FormField label="Localização" htmlFor="location" hint="Cidade, loja ou unidade relacionada (opcional)" className="sm:col-span-2">
                <input id="location" name="location" className="input" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Ex.: São Paulo - SP / Loja Centro" />
              </FormField>
              <FormField label="Descrição detalhada" required error={errors.description} htmlFor="description" className="sm:col-span-2">
                <textarea id="description" name="description" rows={6} className={`input resize-y ${err('description')}`} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Descreva o que aconteceu, quando, números de pedido ou nota fiscal e o que você espera como solução." />
                <p className="mt-1 text-right text-[11px] text-slate-400">{form.description.length} caracteres</p>
              </FormField>
            </div>
          </Section>

          <Section icon={<Eye className="h-4 w-4" />} title="Observadores" description="Adicione pessoas que devem acompanhar e participar deste atendimento.">
            <div className="mb-4 flex gap-2.5 rounded-lg border border-brand-100 bg-brand-50 p-3 text-[13px] text-brand-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Funciona como o campo <b>CC</b> de um e-mail: observadores recebem as atualizações e também podem <b>visualizar, responder e enviar anexos</b> no protocolo.</p>
            </div>
            <ParticipantSelector observers={selectableObservers} selected={observerIds} onChange={setObserverIds} />
          </Section>

          <Section icon={<Paperclip className="h-4 w-4" />} title="Anexos" description="Fotos, notas fiscais, comprovantes ou documentos que ajudem na análise.">
            <FileDropzone onFiles={files.addFiles} />
            {files.attachments.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-slate-500">{files.attachments.length} arquivo(s) selecionado(s)</p>
                <AttachmentList attachments={files.attachments} onRemove={files.remove} />
              </div>
            )}
          </Section>
        </div>

        {/* Resumo lateral */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="card relative overflow-hidden p-5">
            <span className="absolute inset-x-0 top-0 h-1 bg-brand-600" />
            <h2 className="flex items-center gap-2 font-semibold text-slate-900"><img src={asset('favicon-lar.png')} alt="" className="h-5 w-5" />Resumo do protocolo</h2>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              {[
                ['Cliente', form.customerName || '—'],
                ['Itens', `${items.length} item(ns) · ${items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)} un.`],
                ['Solicitante', form.name || '—'],
                ['Equipe', teams.find((t) => t.id === (choosesTeam ? form.teamId : currentUser.teamIds[0]))?.name ?? '—'],
                ['Tipo', form.type],
                ['Categoria', activeCategories.find((c) => c.id === form.categoryId)?.name ?? '—'],
                ['Prioridade', form.priority ? PRIORITY_META[form.priority].label : '—'],
                ['Observadores', observerIds.length ? `${observerIds.length} selecionado(s)` : 'Nenhum'],
                ['Anexos', files.attachments.length ? `${files.attachments.length} arquivo(s)` : 'Nenhum'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="truncate text-right font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-3 text-xs text-slate-600">
              Status inicial: <b className="text-blue-700">Novo</b>. O protocolo será distribuído automaticamente para um atendente disponível.
            </div>
            <button type="submit" disabled={submitting} className="btn-success mt-4 w-full py-2.5 text-[15px] font-semibold tracking-wide">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Abrindo protocolo...</> : <><Send className="h-4 w-4" /> ABRIR PROTOCOLO</>}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">Campos com <span className="text-red-500">*</span> são obrigatórios</p>
          </div>
        </aside>
      </form>

      <Modal open={!!created} onClose={() => navigate(`/protocolos/${created?.protocolNumber}`)} title="Protocolo aberto com sucesso!" size="sm">
        {created && (
          <div className="py-2 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 animate-pop-in items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-8 ring-brand-50/50">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="text-slate-600">Seu protocolo foi criado.</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-brand-800">{created.protocolNumber}</p>
            <p className="mt-3 text-[13px] text-slate-500">Guarde este número para acompanhar o atendimento. {created.observerIds.length > 0 && `${created.observerIds.length} observador(es) foram notificados.`}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button className="btn-primary py-2.5" onClick={() => navigate(`/protocolos/${created.protocolNumber}`)}><Eye className="h-4 w-4" /> Visualizar protocolo</button>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={resetForm}><Plus className="h-4 w-4" /> Abrir outro</button>
                <Link to="/" className="btn-secondary flex-1">Ir para o início</Link>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
