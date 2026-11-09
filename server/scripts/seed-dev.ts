// Dados de exemplo para o banco de DESENVOLVIMENTO: contas fictícias e protocolos
// distribuídos pelos últimos meses, para visualizar o Workflow e o Dashboard.
//   npm run seed:dev            cria os dados
//   npm run seed:dev -- --clear remove apenas o que este script criou
import { hashPassword } from '../src/auth.ts'
import { pool, tx } from '../src/db.ts'

if (process.env.NODE_ENV === 'production') {
  console.error('Este script é apenas para desenvolvimento.')
  process.exit(1)
}

const SAMPLE_PASSWORD = 'exemplo-1234'
const SAMPLE_DOMAIN = '@exemplo.larplasticos.com.br'
const TEAM_1 = 'Equipe 1'
const TEAM_2 = 'Equipe 2'
const TEAM_REP = 'Representação/E-commerce'
const PEOPLE: { name: string; role: string; department: string; title: string; teams?: string[] }[] = [
  { name: 'Ana Paula Ribeiro', role: 'agent', department: 'SAC', title: 'Atendente SAC' },
  { name: 'Ricardo Mendes', role: 'agent', department: 'SAC', title: 'Atendente SAC' },
  { name: 'Cláudia Ferraz', role: 'agent', department: 'SAC', title: 'Coordenadora de SAC' },
  { name: 'Marcos Souza', role: 'seller', department: 'Comercial', title: 'Vendedor', teams: [TEAM_1] },
  { name: 'Juliana Prado', role: 'seller', department: 'Comercial', title: 'Vendedora', teams: [TEAM_1] },
  { name: 'Carla Nunes', role: 'seller', department: 'Comercial', title: 'Vendedora', teams: [TEAM_2] },
  { name: 'Pedro Lima', role: 'seller', department: 'Comercial', title: 'Vendedor', teams: [TEAM_2] },
  { name: 'Rafaela Costa', role: 'seller', department: 'E-commerce', title: 'Representante', teams: [TEAM_REP] },
  { name: 'Fernanda Alves', role: 'coordinator', department: 'Comercial', title: 'Coordenadora Equipe 1', teams: [TEAM_1] },
  { name: 'Bruno Teixeira', role: 'coordinator', department: 'Comercial', title: 'Coordenador Equipe 2', teams: [TEAM_2] },
  { name: 'Tatiane Rocha', role: 'coordinator', department: 'E-commerce', title: 'Coordenadora Representação/E-commerce', teams: [TEAM_REP] },
  { name: 'Lucas Martins', role: 'post_sales', department: 'Pós-vendas', title: 'Pós-vendas', teams: [TEAM_1, TEAM_2] },
  { name: 'João Santos', role: 'observer', department: 'Financeiro', title: 'Observador' },
  { name: 'Maria Silva', role: 'observer', department: 'Logística', title: 'Observador' },
]

// Gerador determinístico: os mesmos dados a cada execução.
let state = 20261007
const rnd = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const pick = <T,>(list: readonly T[]) => list[Math.floor(rnd() * list.length)]
const weighted = <T,>(pairs: readonly (readonly [T, number])[]) => {
  let r = rnd() * pairs.reduce((s, [, w]) => s + w, 0)
  for (const [value, w] of pairs) if ((r -= w) < 0) return value
  return pairs[0][0]
}
const between = (min: number, max: number) => min + rnd() * (max - min)
const minutes = (date: Date, m: number) => new Date(date.getTime() + m * 60000)

const CASES: Record<string, string[]> = {
  Entrega: ['Pedido entregue com atraso', 'Caixa chegou amassada', 'Entrega faltando volumes', 'Transportadora não localiza o pedido'],
  Produto: ['Tampa do organizador trincada', 'Cor diferente da solicitada', 'Rebarba no acabamento do cesto', 'Peça com dimensão fora do padrão'],
  Financeiro: ['Boleto emitido em duplicidade', 'Nota fiscal com valor divergente', 'Solicitação de segunda via de boleto'],
  Comercial: ['Dúvida sobre tabela de preços', 'Pedido de orçamento para linha de baldes', 'Condição de frete para o Nordeste'],
  Reclamação: ['Atendimento do representante', 'Demora no retorno do orçamento'],
  Dúvida: ['Capacidade de carga da caixa 60L', 'Produto pode ir ao micro-ondas?'],
  Solicitação: ['Envio de catálogo atualizado', 'Cadastro de novo ponto de entrega'],
  Sugestão: ['Nova cor para a linha de potes'],
  Falta: ['Pedido chegou com itens faltando', 'Faltaram 2 caixas do lote', 'Volume não entregue pela transportadora'],
  Avaria: ['Produto chegou quebrado', 'Caixa organizadora com tampa trincada', 'Palete tombado no transporte'],
}
const GENERIC_CASES = ['Cliente pede retorno sobre o pedido', 'Solicitação de posicionamento', 'Ocorrência registrada pelo representante']
const TYPE_BY_CATEGORY: Record<string, string> = { Financeiro: 'Solicitação', Comercial: 'Dúvida', Dúvida: 'Dúvida', Solicitação: 'Solicitação', Sugestão: 'Sugestão' }
const STATUS_LABEL: Record<string, string> = { novo: 'Novo', em_atendimento: 'Em atendimento', aguardando_cliente: 'Aguardando cliente', aguardando_terceiro: 'Aguardando terceiro', resolvido: 'Resolvido', fechado: 'Fechado' }

async function clear() {
  await tx(async (db) => {
    const { rows } = await db.query<{ id: string }>('SELECT id FROM users WHERE email LIKE $1', [`%${SAMPLE_DOMAIN}`])
    const ids = rows.map((r) => r.id)
    const removed = await db.query('DELETE FROM protocols WHERE requester_id = ANY($1)', [ids])
    // Contas de exemplo que participaram de protocolos reais são apenas desativadas.
    for (const id of ids) {
      await db.query('SAVEPOINT u')
      try { await db.query('DELETE FROM users WHERE id = $1', [id]) } catch {
        await db.query('ROLLBACK TO SAVEPOINT u')
        await db.query('UPDATE users SET active = false WHERE id = $1', [id])
      }
    }
    console.log(`Removidos ${removed.rowCount} protocolos e ${ids.length} contas de exemplo.`)
  })
}

async function seed() {
  if ((await pool.query('SELECT 1 FROM users WHERE email LIKE $1', [`%${SAMPLE_DOMAIN}`])).rowCount) {
    console.log('Os dados de exemplo já existem. Use "npm run seed:dev -- --clear" para removê-los antes.')
    return
  }
  const passwordHash = await hashPassword(SAMPLE_PASSWORD)

  await tx(async (db) => {
    const teamIds = new Map((await db.query<{ id: string; name: string }>('SELECT id, name FROM teams')).rows.map((t) => [t.name, t.id]))
    // Quem abre protocolos (vendedores e pós-vendas), com as equipes em que pode abrir.
    const openers: { id: string; name: string; teams: string[] }[] = []
    const observers: { id: string; name: string }[] = []
    for (const p of PEOPLE) {
      const email = p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.') + SAMPLE_DOMAIN
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO users (name, email, department, title, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING id`,
        [p.name, email, p.department, p.title, p.role, passwordHash])
      const teams = (p.teams ?? []).map((name) => {
        const id = teamIds.get(name)
        if (!id) throw new Error(`Equipe "${name}" não encontrada. Ela foi renomeada ou removida?`)
        return id
      })
      for (const team of teams) await db.query('INSERT INTO user_teams (user_id, team_id) VALUES ($1, $2)', [rows[0].id, team])
      if (p.role === 'seller' || p.role === 'post_sales') openers.push({ id: rows[0].id, name: p.name, teams })
      if (p.role === 'observer') observers.push({ id: rows[0].id, name: p.name })
    }
    // Os atendentes reais já cadastrados também recebem protocolos.
    const agents = (await db.query<{ id: string; name: string }>(`SELECT id, name FROM users WHERE role = 'agent' AND active ORDER BY name`)).rows
    // Usa as categorias ativas do cadastro, com pesos decrescentes para o ranking de motivos ficar variado.
    const categories = (await db.query<{ id: string; name: string }>('SELECT id, name FROM categories WHERE active ORDER BY created_at, name')).rows
    if (!categories.length) throw new Error('Cadastre ao menos uma categoria ativa antes de gerar os dados de exemplo.')
    const categoryWeights = categories.map((c, i) => [c, Math.max(2, 30 - i * 5)] as const)
    const settings = (await db.query<{ protocol_prefix: string; next_sequence: number }>('SELECT protocol_prefix, next_sequence FROM settings WHERE id = 1 FOR UPDATE')).rows[0]
    // Itens: produtos do catálogo e classificação com a distribuição típica do painel FR-134.
    const products = (await db.query<{ code: string; name: string; family: string }>(`SELECT code, name, family FROM products WHERE active AND family <> '' ORDER BY code`)).rows
    const areas = new Map((await db.query<{ name: string; code: string }>(`SELECT name, code FROM lookups WHERE kind = 'area'`)).rows.map((a) => [a.name, a.code]))
    const MODES = [['FALTA DE COMPONENTE', 44], ['QUEBRADO', 18], ['DANO CIF', 14], ['DIVERGÊNCIA COM O PEDIDO', 7], ['FUNCIONAL', 4], ['FALHA DE INJEÇÃO', 3], ['AMASSADO/TORTO', 3], ['RISCADO', 1]] as const
    const AREA_BY_MODE: Record<string, string> = { 'FALTA DE COMPONENTE': 'GESTÃO INJETORA', QUEBRADO: 'EXPEDIÇÃO', 'DANO CIF': 'EXPEDIÇÃO', 'DIVERGÊNCIA COM O PEDIDO': 'SEPARAÇÃO', 'FALHA DE INJEÇÃO': 'GESTÃO INJETORA' }
    const CUSTOMERS = ['KMI PLASTICOS', 'JERBRA COMERCIAL', 'VW COMERCIO', 'PLESTIN', 'FRUSTACI', 'TNAPLAST', 'GRUPLAST', 'VINPLASTIC', 'ELO SOLUCAO', 'GREEN BAGS']

    // Mais protocolos nos meses recentes; o mês atual vai só até hoje.
    const now = new Date()
    const dates: Date[] = []
    ;[9, 11, 12, 14, 16, 18].forEach((count, i) => {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const lastDay = i === 5 ? now.getDate() : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
      for (let n = 0; n < count; n++) {
        const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 + Math.floor(rnd() * lastDay), 8 + Math.floor(rnd() * 9), Math.floor(rnd() * 60))
        dates.push(d > now ? minutes(now, -between(30, 600)) : d)
      }
    })
    dates.sort((a, b) => a.getTime() - b.getTime())

    let sequence = settings.next_sequence
    for (const createdAt of dates) {
      const ageDays = (now.getTime() - createdAt.getTime()) / 86400000
      const category = weighted(categoryWeights)
      const title = pick(CASES[category.name] ?? GENERIC_CASES)
      const requester = pick(openers)
      const team = pick(requester.teams)
      const agent = pick(agents)
      const priority = weighted([['baixa', 20], ['media', 45], ['alta', 25], ['urgente', 10]] as const)
      // Protocolos antigos estão quase todos encerrados; os recentes mostram todas as etapas do workflow.
      const fate = ageDays > 20
        ? weighted([['fechado', 55], ['resolvido', 40], ['em_atendimento', 5]] as const)
        : weighted([['resolvido', 30], ['sac_owes', 18], ['em_atendimento', 17], ['aguardando_cliente', 15], ['aguardando_terceiro', 10], ['novo', 10]] as const)

      const number = `${settings.protocol_prefix}-${createdAt.getFullYear()}-${String(sequence++).padStart(5, '0')}`
      const description = `${title}. Cliente solicita posicionamento sobre o ocorrido e a previsão de solução.`
      const messages: { author: { id: string; name: string }; role: string; text: string; at: Date }[] = [{ author: requester, role: 'requester', text: description, at: createdAt }]
      const history: [string, string, string, Date][] = [['created', 'Protocolo criado', requester.name, createdAt], ['assigned', `Atribuído automaticamente a ${agent.name}`, 'Sistema', createdAt]]
      const say = (author: { id: string; name: string }, role: string, text: string, after: number) => {
        const at = minutes(messages[messages.length - 1].at, after)
        if (at > now) return false
        messages.push({ author, role, text, at })
        history.push(['message', `${role === 'agent' ? 'Atendente' : role === 'observer' ? 'Observador' : 'Solicitante'} ${author.name} enviou mensagem`, author.name, at])
        return true
      }
      let status = 'novo'
      const setStatus = (to: string, by: string, at: Date) => {
        history.push(['status', `Status alterado${by === 'Sistema' ? ' automaticamente' : ''} de ${STATUS_LABEL[status]} para ${STATUS_LABEL[to]}`, by, at])
        status = to
      }

      let closedAt: Date | null = null
      if (fate !== 'novo') {
        // Primeira resposta: a maioria dentro da meta de 30 minutos.
        if (say(agent, 'agent', 'Olá! Recebemos sua solicitação e já estamos verificando.', rnd() < 0.7 ? between(4, 28) : between(35, 240))) {
          setStatus('em_atendimento', 'Sistema', messages[messages.length - 1].at)
          if (rnd() < 0.6) say(requester, 'requester', 'Obrigado. Seguem o número do pedido e as fotos.', between(20, 300))
          if (fate === 'sac_owes') {
            if (messages[messages.length - 1].role === 'agent') say(requester, 'requester', 'Alguma novidade? O cliente está cobrando um retorno.', between(60, 600))
          } else {
            if (messages[messages.length - 1].role !== 'agent') say(agent, 'agent', 'Acionamos a área responsável e retornamos em breve.', between(10, 180))
            const lastAt = messages[messages.length - 1].at
            if (fate === 'aguardando_cliente') setStatus('aguardando_cliente', agent.name, minutes(lastAt, 1))
            if (fate === 'aguardando_terceiro') setStatus('aguardando_terceiro', agent.name, minutes(lastAt, 1))
            if (fate === 'resolvido' || fate === 'fechado') {
              const done = minutes(lastAt, between(120, 60 * 24 * 6))
              if (done < now && say(agent, 'agent', 'Solução concluída conforme combinado. Qualquer dúvida, estamos à disposição.', (done.getTime() - lastAt.getTime()) / 60000)) {
                closedAt = messages[messages.length - 1].at
                setStatus(fate, agent.name, closedAt)
              }
            }
          }
        }
      }

      const updatedAt = history[history.length - 1][3]
      const id = (await db.query<{ id: string }>(
        `INSERT INTO protocols (protocol_number, title, description, type, category_id, priority, status, location, requester_id,
                                requester_name, requester_email, requester_phone, responsible_id, team_id, created_at, updated_at, closed_at,
                                customer_name, invoice_number, invoice_date, order_number, sale_type, unit, return_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '', $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'MATRIZ', $22) RETURNING id`,
        [number, title, description, TYPE_BY_CATEGORY[category.name] ?? 'Reclamação', category.id, priority, status, pick(['São Paulo - SP', 'Curitiba - PR', 'Recife - PE', 'Belo Horizonte - MG', '']),
          requester.id, requester.name, `${requester.name.split(' ')[0].toLowerCase()}${SAMPLE_DOMAIN}`, agent.id, team, createdAt, updatedAt, closedAt,
          pick(CUSTOMERS), String(170000 + Math.floor(rnd() * 15000)), minutes(createdAt, -between(2, 30) * 1440).toISOString().slice(0, 10),
          String(920000 + Math.floor(rnd() * 5000)), rnd() < 0.97 ? 'B2B' : 'B2C', pick(['CORREIOS', 'CORREIOS', 'NOSSO CARRO', 'TRANSPORTADORA', 'CLIENTE RETIRA'])])).rows[0].id
      // Protocolos novos ainda não foram classificados pelo SAC.
      const classified = status !== 'novo'
      for (let n = rnd() < 0.85 ? 1 : 2; n > 0; n--) {
        const product = pick(products)
        const mode = classified ? weighted(MODES) : ''
        const area = classified ? (AREA_BY_MODE[mode] ?? pick(['MONTAGEM - LOGÍSTICA', 'ROTOMOLDAGEM', 'QUALIDADE / LABORATÓRIO'])) : ''
        const concession = classified && rnd() < 0.02
        const cost = (min: number, max: number) => (classified ? Math.round(between(min, max) * 100) / 100 : 0)
        await db.query(
          `INSERT INTO protocol_items (protocol_id, product_code, product_name, family, quantity, description, location, failure_mode,
                                       responsible_area, area_code, machinery, treatment, commercial_concession,
                                       cost_product, cost_pickup, cost_shipping, cost_postal, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [id, product.code, product.name, product.family, 1 + Math.floor(rnd() * 3), title, classified ? pick(['Corpo', 'Tampa', 'KIT Montagem', 'Pedal', 'Conector']) : '', mode,
            area, areas.get(area) ?? '', classified ? 'INJEÇÃO' : '', !classified ? '' : concession ? 'CONCESSÃO APROVADA' : weighted([['BONIFICADO', 76], ['DEVOLUÇÃO', 12], ['TROCA', 7], ['RECUSA', 2]] as const), concession,
            cost(20, 250), rnd() < 0.15 ? cost(30, 200) : 0, rnd() < 0.3 ? cost(10, 60) : 0, rnd() < 0.5 ? cost(8, 40) : 0, createdAt])
      }
      if (rnd() < 0.3) await db.query('INSERT INTO protocol_observers (protocol_id, user_id) VALUES ($1, $2)', [id, pick(observers).id])
      for (const [i, m] of messages.entries()) {
        await db.query(
          'INSERT INTO messages (protocol_id, author_id, author_name, author_role, content, response_time_min, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [id, m.author.id, m.author.name, m.role, m.text, i ? (m.at.getTime() - messages[i - 1].at.getTime()) / 60000 : null, m.at])
      }
      for (const [kind, text, actor, at] of [...history].sort((a, b) => a[3].getTime() - b[3].getTime())) {
        await db.query('INSERT INTO history_events (protocol_id, kind, description, actor, created_at) VALUES ($1, $2, $3, $4, $5)', [id, kind, text, actor, at])
      }
    }
    await db.query('UPDATE settings SET next_sequence = $1 WHERE id = 1', [sequence])
    console.log(`Criados ${dates.length} protocolos e ${PEOPLE.length} contas de exemplo (senha: ${SAMPLE_PASSWORD}).`)
  })
}

await (process.argv.includes('--clear') ? clear() : seed())
await pool.end()
