import type {
  Attachment, Author, Category, HistoryEvent, Message, Notification, Observer, Priority, Protocol,
  ProtocolStatus, RequestType, Requester, Settings, User,
} from '../types'
import { STATUS_META } from '../utils/protocol'

export const seedUsers: User[] = [
  { id: 'u_marcos', name: 'Marcos Souza', email: 'marcos.souza@cliente.com.br', phone: '(11) 98765-4321', department: 'Cliente', role: 'requester', title: 'Solicitante', active: true },
  { id: 'u_ana', name: 'Ana Paula Ribeiro', email: 'ana.ribeiro@larplasticos.com.br', department: 'SAC', role: 'agent', title: 'Atendente SAC', active: true },
  { id: 'u_ricardo', name: 'Ricardo Mendes', email: 'ricardo.mendes@larplasticos.com.br', department: 'SAC', role: 'agent', title: 'Atendente SAC', active: true },
  { id: 'u_camila', name: 'Camila Torres', email: 'camila.torres@larplasticos.com.br', department: 'SAC', role: 'agent', title: 'Supervisora SAC', active: true },
]

export const seedObservers: Observer[] = [
  { id: 'o_joao', name: 'João Santos', email: 'joao.santos@larplasticos.com.br', department: 'Financeiro', active: true },
  { id: 'o_maria', name: 'Maria Silva', email: 'maria.silva@larplasticos.com.br', department: 'Comercial', active: true },
  { id: 'o_carlos', name: 'Carlos Oliveira', email: 'carlos.oliveira@larplasticos.com.br', department: 'Logística', active: true },
  { id: 'o_fernanda', name: 'Fernanda Souza', email: 'fernanda.souza@larplasticos.com.br', department: 'Qualidade', active: true },
  { id: 'o_rafael', name: 'Rafael Costa', email: 'rafael.costa@larplasticos.com.br', department: 'Jurídico', active: false },
]

export const seedCategories: Category[] = [
  { id: 'cat_reclamacao', name: 'Reclamação', description: 'Problemas e insatisfações relatados pelos clientes', active: true },
  { id: 'cat_sugestao', name: 'Sugestão', description: 'Ideias de melhoria para produtos e serviços', active: true },
  { id: 'cat_duvida', name: 'Dúvida', description: 'Perguntas sobre produtos, uso, garantia e políticas', active: true },
  { id: 'cat_solicitacao', name: 'Solicitação', description: 'Solicitações gerais de clientes', active: true },
  { id: 'cat_produto', name: 'Produto', description: 'Defeitos, qualidade e funcionamento de produtos', active: true },
  { id: 'cat_entrega', name: 'Entrega', description: 'Atrasos, avarias e alterações de entrega', active: true },
  { id: 'cat_financeiro', name: 'Financeiro', description: 'Boletos, cobranças, notas fiscais e reembolsos', active: true },
  { id: 'cat_comercial', name: 'Comercial', description: 'Orçamentos, pedidos e condições comerciais', active: true },
  { id: 'cat_outros', name: 'Outros', description: 'Assuntos que não se encaixam nas demais categorias', active: true },
]

export const seedSettings: Settings = {
  companyName: 'Lar Plásticos',
  protocolPrefix: 'SAC',
  nextSequence: 127,
  firstResponseTargetMin: 30,
  autoAssign: true,
}

const MARCOS: Requester = { name: 'Marcos Souza', email: 'marcos.souza@cliente.com.br', phone: '(11) 98765-4321' }

let counter = 0
const nid = (p: string) => `${p}_seed${++counter}`

type Who = 'req' | string // 'req' = solicitante; demais = id de usuário ou observador

interface SeedMessage {
  at: number // minutos após a abertura
  who: Who
  text: string
  files?: [string, string, number][]
}

interface SeedProtocol {
  seq: number
  title: string
  type: RequestType
  categoryId: string
  priority: Priority
  location: string
  requester: Requester
  responsibleId: string
  observerIds: string[]
  startedMinutesAgo: number
  messages: SeedMessage[]
  statusChanges: [number, ProtocolStatus][]
}

function authorFor(who: Who, requester: Requester): Author {
  if (who === 'req') return { id: 'requester', name: requester.name, role: 'requester' }
  const u = seedUsers.find((x) => x.id === who)
  if (u) return { id: u.id, name: u.name, role: 'agent' }
  const o = seedObservers.find((x) => x.id === who)!
  return { id: o.id, name: o.name, role: 'observer' }
}

function buildProtocol(s: SeedProtocol): Protocol {
  const start = Date.now() - s.startedMinutesAgo * 60000
  const at = (min: number) => new Date(start + min * 60000).toISOString()
  const history: HistoryEvent[] = []
  const attachments: Attachment[] = []

  history.push({ id: nid('h'), kind: 'created', description: 'Protocolo criado', actor: s.requester.name, createdAt: at(0) })
  const responsible = seedUsers.find((u) => u.id === s.responsibleId)!
  history.push({ id: nid('h'), kind: 'assigned', description: `Atribuído a ${responsible.name}`, actor: 'Sistema', createdAt: at(1) })
  s.observerIds.forEach((oid, i) => {
    const o = seedObservers.find((x) => x.id === oid)!
    history.push({ id: nid('h'), kind: 'observer_added', description: `Observador ${o.name} adicionado`, actor: s.requester.name, createdAt: at(2 + i) })
  })

  const messages: Message[] = s.messages.map((m, i) => {
    const author = authorFor(m.who, s.requester)
    const files: Attachment[] = (m.files ?? []).map(([name, type, size]) => ({
      id: nid('a'), name, type, size, uploadedBy: author.name, createdAt: at(m.at),
    }))
    attachments.push(...files)
    if (i > 0) {
      const label = author.role === 'agent' ? 'Atendente' : author.role === 'observer' ? 'Observador' : 'Solicitante'
      history.push({ id: nid('h'), kind: 'message', description: `${label} ${author.name} enviou mensagem`, actor: author.name, createdAt: at(m.at) })
    }
    if (files.length) {
      history.push({ id: nid('h'), kind: 'attachment', description: `${files.length} anexo(s) adicionado(s): ${files.map((f) => f.name).join(', ')}`, actor: author.name, createdAt: at(m.at) })
    }
    return {
      id: nid('m'),
      author,
      content: m.text,
      attachments: files,
      createdAt: at(m.at),
      responseTime: i === 0 ? null : m.at - s.messages[i - 1].at,
    }
  })

  let current: ProtocolStatus = 'novo'
  let closedAt: string | null = null
  s.statusChanges.forEach(([min, to]) => {
    history.push({
      id: nid('h'), kind: 'status',
      description: `Status alterado de ${STATUS_META[current].label} para ${STATUS_META[to].label}`,
      actor: responsible.name, createdAt: at(min),
    })
    current = to
    if (to === 'resolvido' || to === 'fechado') closedAt = closedAt ?? at(min)
  })

  const lastMin = Math.max(s.messages[s.messages.length - 1].at, ...s.statusChanges.map(([m]) => m))
  history.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return {
    id: `p_${s.seq}`,
    protocolNumber: `SAC-2026-${String(s.seq).padStart(5, '0')}`,
    title: s.title,
    description: s.messages[0].text,
    type: s.type,
    categoryId: s.categoryId,
    priority: s.priority,
    status: current,
    location: s.location,
    requester: s.requester,
    responsibleId: s.responsibleId,
    observerIds: s.observerIds,
    messages,
    attachments,
    history,
    createdAt: at(0),
    updatedAt: at(lastMin),
    closedAt,
  }
}

const seedProtocolDefs: SeedProtocol[] = [
  {
    seq: 126, title: 'Cobrança em duplicidade no cartão de crédito', type: 'Reclamação', categoryId: 'cat_financeiro',
    priority: 'urgente', location: 'Campinas - SP', requester: { name: 'Pedro Almeida', email: 'pedro.almeida@gmail.com', phone: '(19) 99123-8844' },
    responsibleId: 'u_camila', observerIds: ['o_joao'], startedMinutesAgo: 130,
    messages: [
      { at: 0, who: 'req', text: 'Realizei a compra do pedido 90412 e o valor de R$ 389,90 foi cobrado duas vezes na fatura do meu cartão. Preciso do estorno de uma das cobranças com urgência.', files: [['fatura-cartao-setembro.pdf', 'application/pdf', 245_760]] },
      { at: 12, who: 'u_camila', text: 'Olá, Pedro. Sinto muito pelo transtorno. Já localizei o pedido 90412 e acionei o time Financeiro para verificar a transação junto à operadora.' },
      { at: 47, who: 'o_joao', text: 'Confirmado: houve dupla captura pela adquirente. Solicitei o cancelamento da segunda transação (NSU 558812). O estorno aparece em até 2 faturas, conforme regra da operadora.' },
      { at: 58, who: 'u_camila', text: 'Pedro, o estorno já foi solicitado. Assim que a operadora nos enviar o comprovante, anexaremos aqui no protocolo.' },
    ],
    statusChanges: [[12, 'em_atendimento']],
  },
  {
    seq: 125, title: 'Orçamento para linha institucional (rede de supermercados)', type: 'Solicitação', categoryId: 'cat_comercial',
    priority: 'media', location: 'Belo Horizonte - MG', requester: { name: 'Beatriz Nogueira', email: 'compras@redebomlar.com.br', phone: '(31) 3344-1200' },
    responsibleId: 'u_ricardo', observerIds: ['o_maria'], startedMinutesAgo: 2 * 1440 + 200,
    messages: [
      { at: 0, who: 'req', text: 'Gostaríamos de receber um orçamento para 1.200 unidades da linha de potes herméticos para abastecer 14 lojas da Rede Bom Lar. Precisamos de condições de pagamento e prazo de entrega.' },
      { at: 34, who: 'u_ricardo', text: 'Olá, Beatriz! Obrigado pelo contato. Encaminhei a solicitação para nossa equipe Comercial, que retornará com a proposta.' },
      { at: 96, who: 'o_maria', text: 'Beatriz, segue a tabela preliminar. Para volumes acima de 1.000 unidades conseguimos 12% de desconto. Estamos confirmando o prazo com a fábrica.', files: [['tabela-precos-institucional.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 88_064]] },
      { at: 110, who: 'u_ricardo', text: 'Aguardando retorno da fábrica sobre a disponibilidade de estoque para confirmar o prazo final.' },
    ],
    statusChanges: [[34, 'em_atendimento'], [110, 'aguardando_terceiro']],
  },
  {
    seq: 124, title: 'Dúvida sobre garantia do organizador modular', type: 'Dúvida', categoryId: 'cat_duvida',
    priority: 'baixa', location: 'São Paulo - SP', requester: MARCOS,
    responsibleId: 'u_ricardo', observerIds: [], startedMinutesAgo: 35,
    messages: [
      { at: 0, who: 'req', text: 'Comprei o organizador modular de 3 gavetas há 8 meses e uma das travas quebrou. Gostaria de saber se o produto ainda está na garantia e como proceder.' },
    ],
    statusChanges: [],
  },
  {
    seq: 123, title: 'Reclamação sobre atraso na entrega', type: 'Reclamação', categoryId: 'cat_entrega',
    priority: 'alta', location: 'São Paulo - SP', requester: MARCOS,
    responsibleId: 'u_ana', observerIds: ['o_carlos', 'o_maria'], startedMinutesAgo: 3 * 1440 + 320,
    messages: [
      { at: 0, who: 'req', text: 'Meu pedido 88731 tinha previsão de entrega para 19/09 e até agora não chegou. O rastreio está parado há 4 dias no centro de distribuição.' },
      { at: 25, who: 'u_ana', text: 'Olá, Marcos. Peço desculpas pelo atraso. Já acionei nossa equipe de Logística para verificar a situação com a transportadora.' },
      { at: 70, who: 'o_carlos', text: 'A transportadora identificou uma avaria na carga durante a rota. O pedido será reenviado hoje com prioridade, com entrega prevista em 48h.' },
      { at: 95, who: 'u_ana', text: 'Marcos, seu pedido foi reenviado. Novo código de rastreio: VT8837451BR. Seguimos acompanhando até a entrega.' },
      { at: 1500, who: 'req', text: 'Recebi o pedido hoje pela manhã, tudo certo. Obrigado pelo retorno rápido!' },
      { at: 1512, who: 'u_ana', text: 'Que ótimo, Marcos! Ficamos felizes em resolver. Estamos encerrando o protocolo. Qualquer necessidade, conte conosco.' },
    ],
    statusChanges: [[25, 'em_atendimento'], [95, 'aguardando_cliente'], [1515, 'resolvido']],
  },
  {
    seq: 122, title: 'Solicitação de segunda via de boleto', type: 'Solicitação', categoryId: 'cat_financeiro',
    priority: 'media', location: 'São Paulo - SP', requester: MARCOS,
    responsibleId: 'u_ricardo', observerIds: ['o_joao'], startedMinutesAgo: 1440 + 190,
    messages: [
      { at: 0, who: 'req', text: 'Preciso da segunda via do boleto referente ao pedido 87781, a primeira parcela venceu ontem e não recebi o documento por e-mail.' },
      { at: 32, who: 'u_ricardo', text: 'Olá, Marcos! Vamos providenciar. Pode confirmar se o boleto deve ser emitido no CNPJ cadastrado no pedido?' },
      { at: 50, who: 'o_joao', text: 'Ricardo, o pedido 87781 possui 2 parcelas. A primeira pode ser reemitida sem juros até sexta-feira.' },
      { at: 64, who: 'u_ricardo', text: 'Marcos, segue o boleto atualizado com vencimento para sexta-feira, sem juros. Pode confirmar o recebimento?', files: [['boleto-2via-pedido-87781.pdf', 'application/pdf', 132_300]] },
    ],
    statusChanges: [[32, 'em_atendimento'], [64, 'aguardando_cliente']],
  },
  {
    seq: 121, title: 'Tampa do pote hermético não veda corretamente', type: 'Reclamação', categoryId: 'cat_produto',
    priority: 'alta', location: 'São Paulo - SP', requester: MARCOS,
    responsibleId: 'u_ana', observerIds: ['o_fernanda', 'o_joao'], startedMinutesAgo: 190,
    messages: [
      { at: 0, who: 'req', text: 'Estou entrando em contato porque comprei um kit com 6 potes herméticos e 3 tampas não estão vedando. Ao virar o pote, o líquido vaza pela lateral.' },
      { at: 18, who: 'u_ana', text: 'Olá, Marcos! Sentimos muito pelo ocorrido. Poderia nos enviar fotos das tampas e a nota fiscal da compra? Assim já abrimos a análise com a Qualidade.' },
      { at: 41, who: 'req', text: 'Obrigado. Segue as fotos e a nota fiscal.', files: [['foto-tampa-lateral.jpg', 'image/jpeg', 1_848_000], ['nota-fiscal-48213.pdf', 'application/pdf', 204_800]] },
      { at: 58, who: 'o_fernanda', text: 'Pelas fotos, trata-se do lote 2608-B, que já está em análise por uma falha na borracha de vedação. Recomendo a troca integral do kit.' },
      { at: 75, who: 'u_ana', text: 'Marcos, recebemos o documento e confirmamos o defeito. Vamos enviar um kit novo sem custo. O código de postagem será enviado em até 1 dia útil.' },
    ],
    statusChanges: [[18, 'em_atendimento']],
  },
  {
    seq: 120, title: 'Sugestão: linha de potes com opção de refil de vedação', type: 'Sugestão', categoryId: 'cat_sugestao',
    priority: 'baixa', location: 'Curitiba - PR', requester: { name: 'Luciana Ferreira', email: 'luciana.ferreira@outlook.com', phone: '(41) 98877-1020' },
    responsibleId: 'u_ricardo', observerIds: ['o_fernanda'], startedMinutesAgo: 6 * 1440 + 400,
    messages: [
      { at: 0, who: 'req', text: 'Adoro os potes de vocês, mas depois de um tempo a borracha da tampa resseca. Seria ótimo poder comprar só o anel de vedação como refil.' },
      { at: 55, who: 'u_ricardo', text: 'Olá, Luciana! Agradecemos muito a sugestão. Vamos encaminhar para a área de Produto avaliar.' },
      { at: 190, who: 'o_fernanda', text: 'Sugestão registrada no backlog de melhorias da linha 2027. Obrigada, Luciana!' },
      { at: 200, who: 'u_ricardo', text: 'Luciana, sua sugestão foi registrada oficialmente. Estamos encerrando o protocolo, obrigado pela contribuição!' },
    ],
    statusChanges: [[55, 'em_atendimento'], [200, 'resolvido'], [1640, 'fechado']],
  },
  {
    seq: 119, title: 'Produto chegou com trinca na base', type: 'Reclamação', categoryId: 'cat_produto',
    priority: 'alta', location: 'São Paulo - SP', requester: MARCOS,
    responsibleId: 'u_ana', observerIds: ['o_carlos'], startedMinutesAgo: 9 * 1440 + 120,
    messages: [
      { at: 0, who: 'req', text: 'A lixeira com pedal que recebi veio com uma trinca na base. Gostaria de efetuar a troca.', files: [['foto-trinca-base.jpg', 'image/jpeg', 2_310_000]] },
      { at: 22, who: 'u_ana', text: 'Olá, Marcos. Lamentamos o ocorrido. Já geramos a autorização de coleta reversa, o código foi enviado ao seu e-mail.' },
      { at: 140, who: 'o_carlos', text: 'Coleta agendada para amanhã entre 8h e 18h. O produto novo segue na mesma data.' },
      { at: 2900, who: 'req', text: 'Produto trocado, tudo certo. Obrigado!' },
      { at: 2921, who: 'u_ana', text: 'Perfeito! Encerrando o protocolo. Obrigada, Marcos.' },
    ],
    statusChanges: [[22, 'em_atendimento'], [2921, 'resolvido']],
  },
  {
    seq: 118, title: 'Alteração de endereço de entrega', type: 'Solicitação', categoryId: 'cat_entrega',
    priority: 'media', location: 'Recife - PE', requester: { name: 'Thiago Martins', email: 'thiago.martins@empresa.com', phone: '(81) 99654-3321' },
    responsibleId: 'u_ana', observerIds: [], startedMinutesAgo: 12 * 1440 + 90,
    messages: [
      { at: 0, who: 'req', text: 'Preciso alterar o endereço de entrega do pedido 86120, pois mudei de escritório. Novo endereço: Av. Boa Viagem, 3200, sala 804.' },
      { at: 15, who: 'u_ana', text: 'Olá, Thiago! Endereço atualizado com sucesso. O pedido ainda não havia sido faturado, então não haverá alteração no prazo.' },
      { at: 30, who: 'req', text: 'Perfeito, muito obrigado!' },
    ],
    statusChanges: [[15, 'em_atendimento'], [31, 'resolvido'], [1480, 'fechado']],
  },
  {
    seq: 117, title: 'Nota fiscal emitida com CNPJ incorreto', type: 'Solicitação', categoryId: 'cat_financeiro',
    priority: 'alta', location: 'Belo Horizonte - MG', requester: { name: 'Beatriz Nogueira', email: 'compras@redebomlar.com.br', phone: '(31) 3344-1200' },
    responsibleId: 'u_ricardo', observerIds: ['o_joao'], startedMinutesAgo: 15 * 1440 + 300,
    messages: [
      { at: 0, who: 'req', text: 'A NF 48877 foi emitida para o CNPJ da matriz, mas deveria ser para a filial 0003. Precisamos da carta de correção ou reemissão.' },
      { at: 41, who: 'u_ricardo', text: 'Olá, Beatriz. Vamos verificar com o Faturamento qual o procedimento adequado para este caso.' },
      { at: 180, who: 'o_joao', text: 'Como a mudança é de CNPJ, não é possível carta de correção. Cancelamos a NF 48877 e emitimos a NF 48912 para a filial correta.', files: [['NF-48912.pdf', 'application/pdf', 98_304]] },
      { at: 192, who: 'u_ricardo', text: 'Beatriz, segue a nova nota fiscal em anexo. Qualquer dúvida, estamos à disposição.' },
    ],
    statusChanges: [[41, 'em_atendimento'], [192, 'resolvido']],
  },
]

export function buildSeedProtocols(): Protocol[] {
  counter = 0
  return seedProtocolDefs.map(buildProtocol)
}

export function buildSeedNotifications(protocols: Protocol[]): Notification[] {
  const p121 = protocols.find((p) => p.protocolNumber.endsWith('00121'))!
  const p126 = protocols.find((p) => p.protocolNumber.endsWith('00126'))!
  const p122 = protocols.find((p) => p.protocolNumber.endsWith('00122'))!
  const last = (p: Protocol) => p.messages[p.messages.length - 1]
  return [
    { id: 'n_seed1', title: `Novo comentário no protocolo ${p121.protocolNumber}`, body: `${last(p121).author.name} respondeu ao protocolo.`, protocolNumber: p121.protocolNumber, createdAt: last(p121).createdAt, read: false },
    { id: 'n_seed2', title: `Novo comentário no protocolo ${p126.protocolNumber}`, body: `${last(p126).author.name} respondeu ao protocolo.`, protocolNumber: p126.protocolNumber, createdAt: last(p126).createdAt, read: false },
    { id: 'n_seed3', title: `Aguardando sua confirmação — ${p122.protocolNumber}`, body: 'Status alterado para Aguardando cliente.', protocolNumber: p122.protocolNumber, createdAt: last(p122).createdAt, read: true },
  ]
}
