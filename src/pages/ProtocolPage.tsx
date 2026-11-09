import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Clock, FileSearch, History, Info, MapPin, Mail, MessageSquare, Package, PanelRightOpen, Paperclip, Phone,
  Plus, User, UserCheck, Users, X,
} from 'lucide-react'
import { useStore } from '../store/StoreContext'
import type { ProtocolStatus } from '../types'
import { STATUS_META } from '../utils/protocol'
import { formatDateTime, formatRelative } from '../utils/format'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/StatusBadge'
import { PriorityBadge } from '../components/PriorityBadge'
import { StatusSelect } from '../components/StatusSelect'
import { ProtocolTimeline } from '../components/ProtocolTimeline'
import { MessageComposer } from '../components/MessageComposer'
import { ProtocolDetails, ProtocolMetrics, SectionTitle } from '../components/ProtocolDetails'
import { ParticipantList } from '../components/ParticipantList'
import { ParticipantSelector } from '../components/ParticipantSelector'
import { ProtocolHistory } from '../components/ProtocolHistory'
import { AttachmentList } from '../components/AttachmentList'
import { FileDropzone } from '../components/FileDropzone'
import { Modal } from '../components/Modal'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { asset } from '../utils/asset'
import { canSeePortfolio, isSacTeam } from '../utils/access'
import { ProtocolItems } from '../components/ProtocolItems'

type Tab = 'conversa' | 'itens' | 'detalhes' | 'anexos' | 'participantes' | 'historico'

export function ProtocolRoute() {
  const { number } = useParams()
  return <ProtocolPage key={number} number={number ?? ''} />
}

function ProtocolPage({ number }: { number: string }) {
  const store = useStore()
  const { protocols, currentUser, users, observers, getCategoryName, getUser } = store
  const protocol = protocols.find((p) => p.protocolNumber === number)
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('conversa')
  const [drawer, setDrawer] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [toAdd, setToAdd] = useState<string[]>([])
  const chatRef = useRef<HTMLDivElement>(null)
  const count = protocol?.messages.length ?? 0
  const firstScroll = useRef(true)

  // Rola o chat para a última mensagem (sem mover a página inteira).
  useLayoutEffect(() => {
    const el = chatRef.current
    if (!el || tab !== 'conversa') return
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? 'auto' : 'smooth' })
    firstScroll.current = false
  }, [count, tab])


  if (!protocol) {
    return (
      <div className="card">
        <EmptyState
          icon={<FileSearch className="h-6 w-6" />}
          title="Protocolo não encontrado"
          description={`Não localizamos o protocolo ${number}. Verifique o número ou procure na lista de protocolos.`}
          action={<Link to="/meus-protocolos" className="btn-primary">Ver meus protocolos</Link>}
        />
      </div>
    )
  }

  const canManage = isSacTeam(currentUser)
  // A equipe SAC e quem abriu o protocolo podem remover observadores.
  const canRemoveObservers = canManage || protocol.requesterId === currentUser.id
  const responsible = getUser(protocol.responsibleId)
  const listPath = canSeePortfolio(currentUser) ? '/protocolos' : '/meus-protocolos'

  const changeStatus = async (s: ProtocolStatus) => {
    const from = STATUS_META[protocol.status].label
    if (!(await store.changeStatus(protocol.id, s))) return
    toast({ variant: 'success', title: 'Status atualizado', description: `Status alterado de ${from} para ${STATUS_META[s].label}.` })
  }

  const assign = async (userId: string) => {
    if (!(await store.assignResponsible(protocol.id, userId))) return
    toast({ variant: 'success', title: 'Responsável atualizado', description: `Protocolo atribuído a ${users.find((u) => u.id === userId)?.name}.` })
  }

  const confirmObservers = async () => {
    if (!toAdd.length) return
    if (!(await store.addObservers(protocol.id, toAdd))) return
    const names = toAdd.map((id) => observers.find((o) => o.id === id)?.name).join(', ')
    toast({ variant: 'success', title: toAdd.length > 1 ? 'Observadores adicionados' : 'Observador adicionado', description: `${names} agora participa(m) deste protocolo.` })
    setToAdd([])
    setAddOpen(false)
  }

  const removeObserver = async (id: string) => {
    if (!(await store.removeObserver(protocol.id, id))) return
    toast({ variant: 'info', title: 'Observador removido', description: `${observers.find((o) => o.id === id)?.name} não acompanha mais este protocolo.` })
  }

  const uploadToProtocol = async (files: FileList) => {
    const list = Array.from(files)
    if (!(await store.addAttachments(protocol.id, list))) return
    toast({ variant: 'success', title: 'Anexo adicionado', description: `${list.length} arquivo(s) anexado(s) ao protocolo.` })
  }

  const openAdd = () => { setToAdd([]); setAddOpen(true); setDrawer(false) }

  const TABS: { id: Tab; label: string; icon: typeof Info; count?: number }[] = [
    { id: 'conversa', label: 'Conversa', icon: MessageSquare, count: protocol.messages.length },
    { id: 'itens', label: 'Itens', icon: Package, count: protocol.items.length },
    { id: 'detalhes', label: 'Detalhes', icon: Info },
    { id: 'anexos', label: 'Anexos', icon: Paperclip, count: protocol.attachments.length },
    { id: 'participantes', label: 'Participantes', icon: Users },
    { id: 'historico', label: 'Histórico', icon: History, count: protocol.history.length },
  ]

  const details = <ProtocolDetails protocol={protocol} onAddObserver={openAdd} onRemoveObserver={canRemoveObservers ? removeObserver : undefined} />

  return (
    <div className="animate-slide-up">
      {/* Cabeçalho do protocolo */}
      <div className="mb-5">
        <nav aria-label="Você está em" className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Link to={listPath} className="flex items-center gap-1 hover:text-brand-600"><ArrowLeft className="h-3.5 w-3.5" /> Protocolos</Link>
          <span className="text-slate-300">/</span>
          <span className="font-mono text-slate-700">{protocol.protocolNumber}</span>
        </nav>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-5 py-2.5">
            <span className="flex items-center gap-3">
              <img src={asset('logo-lar.png')} alt="Lar Plásticos" className="h-6 w-auto" />
              <span className="hidden text-[11px] font-semibold tracking-wider text-brand-700 uppercase sm:inline">SAC · Central de Atendimento</span>
            </span>
            <span className="font-mono text-[13px] font-semibold text-brand-800">{protocol.protocolNumber}</span>
          </div>
          <div className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[22px]">
                Protocolo <span className="font-mono text-brand-700">{protocol.protocolNumber}</span>
              </h1>
              <StatusBadge status={protocol.status} size="md" />
              <PriorityBadge priority={protocol.priority} />
            </div>
            <p className="mt-1 text-[15px] text-slate-700">{protocol.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5 text-brand-600" />{protocol.requester.name}</span>
              <span className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-brand-600" />Responsável: {responsible?.name ?? 'Não atribuído'}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-brand-600" />Atualizado {formatRelative(protocol.updatedAt)} ({formatDateTime(protocol.updatedAt)})</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canManage && (
              <select
                value={protocol.responsibleId ?? ''}
                onChange={(e) => assign(e.target.value)}
                className="input w-auto py-2 text-[13px]"
                aria-label="Responsável"
              >
                <option value="" disabled>Atribuir responsável</option>
                {users.filter((u) => u.role === 'agent' && u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <StatusSelect
              value={protocol.status}
              onChange={changeStatus}
              disabled={!canManage}
              disabledReason="Apenas a equipe SAC pode alterar o status."
            />
            <button onClick={() => setDrawer(true)} className="btn-secondary xl:hidden">
              <PanelRightOpen className="h-4 w-4" /> Detalhes
            </button>
          </div>
        </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Coluna principal */}
        <div className="card flex min-w-0 flex-col overflow-hidden">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex shrink-0 items-center gap-2 px-3 py-3.5 text-[13px] font-medium transition-colors ${tab === t.id ? 'text-brand-700' : 'text-slate-500 hover:text-brand-700'}`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.count != null && <span className={`rounded-full px-1.5 text-[11px] ${tab === t.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>}
                {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 animate-fade-in rounded-full bg-brand-600" />}
              </button>
            ))}
          </div>

          {tab === 'conversa' && (
            <>
              <div ref={chatRef} className="h-[calc(100vh-460px)] min-h-[380px] overflow-y-auto bg-canvas/60 px-4 py-5 sm:px-6">
                <ProtocolTimeline key={protocol.id} protocol={protocol} />
              </div>
              <MessageComposer key={protocol.id} protocol={protocol} />
            </>
          )}

          {tab === 'itens' && <ProtocolItems protocol={protocol} canManage={canManage} />}

          {tab === 'detalhes' && (
            <div className="animate-fade-in space-y-6 p-5 sm:p-6">
              <div>
                <SectionTitle icon={<Info className="h-3.5 w-3.5" />}>Descrição da solicitação</SectionTitle>
                <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-700">{protocol.description}</p>
              </div>
              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Protocolo', <span key="n" className="font-mono">{protocol.protocolNumber}</span>],
                  ['Status', <StatusBadge key="s" status={protocol.status} />],
                  ['Prioridade', <PriorityBadge key="p" priority={protocol.priority} />],
                  ['Tipo', protocol.type],
                  ['Categoria', getCategoryName(protocol.categoryId)],
                  ['Localização', protocol.location ? <span key="l" className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{protocol.location}</span> : '—'],
                  ['Responsável', responsible?.name ?? 'Não atribuído'],
                  ['Data de abertura', formatDateTime(protocol.createdAt)],
                  ['Última atualização', formatDateTime(protocol.updatedAt)],
                  ['Encerramento', formatDateTime(protocol.closedAt)],
                ].map(([label, value], i) => (
                  <div key={i}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
                  </div>
                ))}
              </div>
              <div>
                <SectionTitle icon={<User className="h-3.5 w-3.5" />}>Solicitante</SectionTitle>
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 p-4">
                  <Avatar name={protocol.requester.name} size="lg" />
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">{protocol.requester.name}</p>
                    <p className="flex items-center gap-1.5 text-slate-600"><Mail className="h-3.5 w-3.5" />{protocol.requester.email}</p>
                    {protocol.requester.phone && <p className="flex items-center gap-1.5 text-slate-600"><Phone className="h-3.5 w-3.5" />{protocol.requester.phone}</p>}
                  </div>
                </div>
              </div>
              <div>
                <SectionTitle icon={<Clock className="h-3.5 w-3.5" />}>Tempo de atendimento</SectionTitle>
                <div className="max-w-lg"><ProtocolMetrics protocol={protocol} /></div>
              </div>
            </div>
          )}

          {tab === 'anexos' && (
            <div className="animate-fade-in space-y-4 p-5 sm:p-6">
              <FileDropzone onFiles={uploadToProtocol} />
              {protocol.attachments.length ? (
                <AttachmentList attachments={[...protocol.attachments].reverse()} showMeta />
              ) : (
                <EmptyState icon={<Paperclip className="h-6 w-6" />} title="Nenhum anexo" description="Arquivos enviados na abertura ou na conversa aparecem aqui." />
              )}
            </div>
          )}

          {tab === 'participantes' && (
            <div className="animate-fade-in p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] text-slate-500">Todos os participantes podem visualizar, responder e anexar arquivos neste protocolo.</p>
                <button onClick={openAdd} className="btn-primary shrink-0"><Plus className="h-4 w-4" /> Adicionar observador</button>
              </div>
              <ParticipantList protocol={protocol} detailed onRemoveObserver={canRemoveObservers ? removeObserver : undefined} />
            </div>
          )}

          {tab === 'historico' && (
            <div className="animate-fade-in p-5 sm:p-6">
              <ProtocolHistory protocol={protocol} />
            </div>
          )}
        </div>

        {/* Painel lateral (desktop) */}
        <aside className="card hidden self-start overflow-hidden xl:sticky xl:top-24 xl:block xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          {details}
        </aside>
      </div>

      {/* Painel lateral (tablet/celular) */}
      {drawer && createPortal(
        <div className="fixed inset-0 z-[60] xl:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm animate-slide-in-right overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <p className="font-semibold text-slate-900">Detalhes do protocolo</p>
              <button onClick={() => setDrawer(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            {details}
          </div>
        </div>,
        document.body,
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Adicionar observadores"
        description={`Selecione quem deve acompanhar e participar do protocolo ${protocol.protocolNumber}.`}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancelar</button>
            <button className="btn-primary" disabled={!toAdd.length} onClick={confirmObservers}>
              Adicionar {toAdd.length > 0 && `(${toAdd.length})`}
            </button>
          </>
        }
      >
        <ParticipantSelector observers={observers} selected={toAdd} onChange={setToAdd} disabledIds={[...protocol.observerIds, protocol.requesterId]} />
      </Modal>
    </div>
  )
}
