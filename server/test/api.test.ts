// Testes de ponta a ponta da API contra um banco PostgreSQL descartável.
// Requer o banco de desenvolvimento no ar: docker compose -f docker-compose.dev.yml up -d
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import pg from 'pg'

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://sac:sac@127.0.0.1:5433/postgres'
const DB_NAME = `sac_test_${process.pid}`
const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sac-uploads-'))

process.env.DATABASE_URL = ADMIN_URL.replace(/\/[^/]+$/, `/${DB_NAME}`)
process.env.UPLOAD_DIR = uploadDir
process.env.MAX_FILE_MB = '1'

let base = ''
let close: () => Promise<void> = async () => {}

/** Cliente HTTP mínimo que guarda o cookie de sessão, como um navegador. */
class Client {
  cookie = ''

  async call(method: string, url: string, body?: unknown) {
    const headers: Record<string, string> = {}
    if (this.cookie) headers.cookie = this.cookie
    let payload: BodyInit | undefined
    if (body instanceof FormData) payload = body
    else if (body !== undefined) { payload = JSON.stringify(body); headers['content-type'] = 'application/json' }
    const res = await fetch(base + url, { method, headers, body: payload })
    const set = res.headers.get('set-cookie')
    if (set) this.cookie = set.split(';')[0]
    return res
  }

  async json(method: string, url: string, body?: unknown, expected = 200) {
    const res = await this.call(method, url, body)
    const data = await res.json() as any
    assert.equal(res.status, expected, `${method} ${url} → ${res.status} ${JSON.stringify(data)}`)
    return data
  }
}

const admin = new Client()
const accounts: Record<string, { client: Client; id: string }> = {}

async function signIn(email: string, temporaryPassword: string) {
  const client = new Client()
  const login = await client.json('POST', '/api/auth/login', { email, password: temporaryPassword })
  assert.equal(login.user.mustChangePassword, true)
  // Com senha provisória nada é liberado além da troca de senha.
  assert.equal((await client.call('GET', '/api/bootstrap')).status, 403)
  await client.json('POST', '/api/auth/change-password', { currentPassword: temporaryPassword, newPassword: `${temporaryPassword}-nova` })
  return client
}

async function createAccount(key: string, role: string, extra: Record<string, unknown> = {}) {
  const email = `${key}@larplasticos.com.br`
  const res = await admin.json('POST', '/api/admin/users', { name: `Pessoa ${key}`, email, role, department: 'Teste', title: role, ...extra }, 201)
  assert.match(res.temporaryPassword, /^.{12}$/)
  accounts[key] = { client: await signIn(email, res.temporaryPassword), id: res.user.id }
}

function protocolForm(data: Record<string, unknown>, files: [string, string | Uint8Array, string?][] = []) {
  const form = new FormData()
  form.set('data', JSON.stringify(data))
  for (const [name, content, type] of files) form.append('files', new Blob([content as BlobPart], { type: type ?? 'text/plain' }), name)
  return form
}

let categoryId = ''
const teams: Record<string, string> = {}
const newProtocol = (over: Record<string, unknown> = {}) => ({
  requester: { name: 'Cliente Exemplo', email: 'cliente@exemplo.com.br', phone: '' },
  type: 'Reclamação', categoryId, title: 'Produto com avaria', priority: 'alta', location: '',
  description: 'A embalagem chegou amassada e o produto está riscado.', observerIds: [],
  customerName: 'PLASTCOMP', invoiceNumber: '173923', invoiceDate: '2025-11-28', orderNumber: '920506', saleType: 'B2B',
  items: [{ productCode: '14531', quantity: 1, description: 'Furo na caixa' }], ...over,
})

before(async () => {
  const root = new pg.Client({ connectionString: ADMIN_URL })
  await root.connect()
  await root.query(`CREATE DATABASE ${DB_NAME}`)
  await root.end()

  const { migrate, pool } = await import('../src/db.ts')
  const { hashPassword } = await import('../src/auth.ts')
  const { buildApp } = await import('../src/app.ts')
  await migrate()
  await pool.query(
    `INSERT INTO users (name, email, role, is_admin, password_hash) VALUES ('Admin', 'admin@larplasticos.com.br', 'agent', true, $1)`,
    [await hashPassword('senha-inicial')])
  const app = await buildApp({ logger: false })
  base = await app.listen({ port: 0, host: '127.0.0.1' })
  close = async () => {
    await app.close()
    await pool.end()
    const drop = new pg.Client({ connectionString: ADMIN_URL })
    await drop.connect()
    await drop.query(`DROP DATABASE ${DB_NAME} WITH (FORCE)`)
    await drop.end()
    await fs.rm(uploadDir, { recursive: true, force: true })
  }
})

after(() => close())

test('login, troca de senha obrigatória e cadastro de contas', async () => {
  assert.equal((await admin.call('GET', '/api/bootstrap')).status, 401)
  await admin.json('POST', '/api/auth/login', { email: 'admin@larplasticos.com.br', password: 'errada' }, 401)
  await admin.json('POST', '/api/auth/login', { email: 'ninguem@larplasticos.com.br', password: 'errada' }, 401)
  admin.cookie = (await signIn('ADMIN@larplasticos.com.br', 'senha-inicial')).cookie

  // O administrador inicial é atendente: sai da fila para os testes de distribuição.
  const boot = await admin.json('GET', '/api/bootstrap')
  categoryId = boot.categories[0].id
  assert.equal(boot.categories.length, 9)
  assert.equal(boot.protocols.length, 0)
  for (const t of boot.teams) teams[t.name] = t.id
  assert.deepEqual(Object.keys(teams).sort(), ['Equipe 1', 'Equipe 2', 'Representação/E-commerce'])

  await createAccount('ana', 'agent')
  await createAccount('rui', 'agent')
  await createAccount('marcos', 'seller', { teamIds: [teams['Equipe 1']] })
  await createAccount('paula', 'seller', { teamIds: [teams['Equipe 2']] })
  await createAccount('joao', 'observer')
  assert.deepEqual((await accounts.marcos.client.json('GET', '/api/auth/me')).user.teamIds, [teams['Equipe 1']])

  await admin.json('POST', '/api/admin/users', { name: 'Duplicado', email: 'ANA@larplasticos.com.br', role: 'agent' }, 409)
  await accounts.marcos.client.json('POST', '/api/admin/users', { name: 'X', email: 'x@larplasticos.com.br', role: 'agent' }, 403)
  await accounts.marcos.client.json('PATCH', '/api/admin/settings', { companyName: 'X', protocolPrefix: 'X', nextSequence: 1, firstResponseTargetMin: 1, autoAssign: true }, 403)
})

test('abertura: numeração, distribuição, anexo e observador', async () => {
  const { marcos, joao } = accounts
  const res = await marcos.client.json('POST', '/api/protocols',
    protocolForm(newProtocol({ observerIds: [joao.id] }), [['nota fiscal nº 10.txt', 'conteúdo da nota']]), 201)
  const p = res.protocol
  assert.equal(p.protocolNumber, `SAC-${new Date().getFullYear()}-00001`)
  assert.equal(p.status, 'novo')
  assert.equal(p.requesterId, marcos.id)
  assert.equal(p.teamId, teams['Equipe 1'], 'o protocolo do vendedor fica na carteira dele')
  assert.deepEqual(p.observerIds, [joao.id])
  assert.equal(p.messages.length, 1)
  assert.equal(p.messages[0].author.role, 'requester')
  assert.equal(p.messages[0].responseTime, null)
  assert.equal(p.attachments[0].name, 'nota fiscal nº 10.txt')
  assert.deepEqual(p.history.map((h: any) => h.kind), ['created', 'assigned', 'observer_added', 'attachment'])
  assert.ok(p.responsibleId, 'deve ser atribuído automaticamente')

  const file = await marcos.client.call('GET', p.attachments[0].url)
  assert.equal(file.status, 200)
  assert.equal(await file.text(), 'conteúdo da nota')
  assert.match(file.headers.get('content-disposition') ?? '', /^attachment/)
})

test('aberturas simultâneas não repetem número e equilibram a fila', async () => {
  const { marcos, paula } = accounts
  const created = await Promise.all(Array.from({ length: 8 }, (_, i) =>
    (i % 2 ? marcos : paula).client.json('POST', '/api/protocols', protocolForm(newProtocol({ title: `Simultâneo ${i}` })), 201)))
  const numbers = created.map((c) => c.protocol.protocolNumber)
  assert.equal(new Set(numbers).size, 8)
  assert.deepEqual([...numbers].sort(), Array.from({ length: 8 }, (_, i) => `SAC-${new Date().getFullYear()}-0000${i + 2}`))

  const all = (await admin.json('GET', '/api/bootstrap')).protocols
  assert.equal(all.length, 9)
  const load = new Map<string, number>()
  for (const p of all) load.set(p.responsibleId, (load.get(p.responsibleId) ?? 0) + 1)
  // 9 protocolos entre 3 atendentes ativos (admin, ana, rui).
  assert.deepEqual([...load.values()].sort(), [3, 3, 3])
})

test('cada pessoa só enxerga os protocolos de que participa', async () => {
  const { marcos, paula, joao, ana } = accounts
  const mine = (await marcos.client.json('GET', '/api/bootstrap')).protocols
  assert.equal(mine.length, 5)
  const first = mine.find((p: any) => p.protocolNumber.endsWith('00001'))

  const hers = await paula.client.json('GET', '/api/bootstrap')
  assert.equal(hers.protocols.length, 4)
  assert.ok(hers.protocols.every((p: any) => p.requesterId === paula.id))
  // Solicitantes não recebem o cadastro dos outros solicitantes.
  assert.ok(hers.users.every((u: any) => u.role === 'agent' || u.id === paula.id))

  assert.deepEqual((await joao.client.json('GET', '/api/bootstrap')).protocols.map((p: any) => p.id), [first.id])
  assert.equal((await ana.client.json('GET', '/api/bootstrap')).protocols.length, 9)

  const form = new FormData()
  form.set('content', 'intrusa')
  await paula.client.json('POST', `/api/protocols/${first.id}/messages`, form, 404)
  assert.equal((await paula.client.call('GET', first.attachments[0].url)).status, 404)
  await paula.client.json('POST', `/api/protocols/${first.id}/observers`, { ids: [joao.id] }, 404)
  assert.equal((await new Client().call('GET', first.attachments[0].url)).status, 401)
})

test('conversa: tempos de resposta, transições de status e notificações', async () => {
  const { marcos, joao, ana } = accounts
  const first = (await marcos.client.json('GET', '/api/bootstrap')).protocols.find((p: any) => p.protocolNumber.endsWith('00001'))
  const say = (client: Client, content: string) => {
    const form = new FormData()
    form.set('content', content)
    return client.json('POST', `/api/protocols/${first.id}/messages`, form)
  }

  await marcos.client.json('PATCH', `/api/protocols/${first.id}`, { status: 'resolvido' }, 403)
  await joao.client.json('PATCH', `/api/protocols/${first.id}`, { status: 'resolvido' }, 403)

  let p = (await say(ana.client, 'Olá, vamos verificar.')).protocol
  assert.equal(p.status, 'em_atendimento')
  assert.equal(p.messages[1].author.role, 'agent')
  assert.equal(typeof p.messages[1].responseTime, 'number')
  assert.ok(p.messages[1].responseTime >= 0)

  p = (await say(joao.client, 'Financeiro acompanhando.')).protocol
  assert.equal(p.messages[2].author.role, 'observer')

  p = (await ana.client.json('PATCH', `/api/protocols/${first.id}`, { status: 'aguardando_cliente' })).protocol
  assert.equal(p.status, 'aguardando_cliente')
  p = (await say(marcos.client, 'Segue a informação pedida.')).protocol
  assert.equal(p.status, 'em_atendimento')

  p = (await ana.client.json('PATCH', `/api/protocols/${first.id}`, { status: 'resolvido', responsibleId: ana.id })).protocol
  assert.equal(p.responsibleId, ana.id)
  assert.ok(p.closedAt)
  p = (await ana.client.json('PATCH', `/api/protocols/${first.id}`, { status: 'em_atendimento' })).protocol
  assert.equal(p.closedAt, null)
  await ana.client.json('PATCH', `/api/protocols/${first.id}`, { responsibleId: marcos.id }, 400)

  const inbox = (await marcos.client.json('GET', '/api/bootstrap')).notifications
  assert.ok(inbox.some((n: any) => n.title.startsWith('Novo comentário') && n.body.includes('ana')))
  assert.ok(inbox.some((n: any) => n.title.startsWith('Status do protocolo')))
  assert.ok(inbox.every((n: any) => !n.body.startsWith('Pessoa marcos respondeu')), 'ninguém é notificado da própria mensagem')
  await marcos.client.json('POST', '/api/notifications/read', {})
  assert.ok((await marcos.client.json('GET', '/api/bootstrap')).notifications.every((n: any) => n.read))

  // Observador: entra, sai e perde o acesso.
  await marcos.client.json('DELETE', `/api/protocols/${first.id}/observers/${joao.id}`)
  assert.equal((await joao.client.json('GET', '/api/bootstrap')).protocols.length, 0)
  p = (await marcos.client.json('POST', `/api/protocols/${first.id}/observers`, { ids: [joao.id, ana.id] })).protocol
  assert.deepEqual(p.observerIds, [joao.id], 'atendentes não entram como observadores')
  assert.equal((await joao.client.json('DELETE', `/api/protocols/${first.id}/observers/${joao.id}`)).protocol, null)
})

test('anexos: tipos bloqueados, limite de tamanho e limpeza do disco', async () => {
  const { marcos } = accounts
  const first = (await marcos.client.json('GET', '/api/bootstrap')).protocols.find((p: any) => p.protocolNumber.endsWith('00001'))
  const before = (await fs.readdir(uploadDir)).length

  const upload = (files: [string, string | Uint8Array, string?][]) => {
    const form = new FormData()
    for (const [name, content, type] of files) form.append('files', new Blob([content as BlobPart], { type }), name)
    return marcos.client.call('POST', `/api/protocols/${first.id}/attachments`, form)
  }
  assert.equal((await upload([['ok.pdf', 'pdf', 'application/pdf'], ['virus.exe', 'MZ']])).status, 400)
  assert.equal((await upload([['pagina.html', '<script>alert(1)</script>', 'text/html']])).status, 400)
  assert.equal((await upload([['grande.bin', new Uint8Array(1024 * 1024 + 10)]])).status, 413)
  assert.equal((await marcos.client.call('POST', '/api/protocols', protocolForm(newProtocol({ title: '' }), [['a.txt', 'a']]))).status, 400)
  assert.equal((await fs.readdir(uploadDir)).length, before, 'envios rejeitados não deixam arquivos no disco')

  const ok = await upload([['foto.png', 'png', 'image/png'], ['../../etc/passwd', 'x']])
  assert.equal(ok.status, 200)
  const { protocol } = await ok.json() as any
  assert.deepEqual(protocol.attachments.slice(-2).map((a: any) => a.name), ['foto.png', 'passwd'])
  const png = await marcos.client.call('GET', protocol.attachments.at(-2).url)
  assert.equal(png.headers.get('content-type'), 'image/png')
  assert.match(png.headers.get('content-disposition') ?? '', /^inline/)
  assert.equal(png.headers.get('x-content-type-options'), 'nosniff')
})

test('administração: categorias, configurações, redefinição de senha e desativação', async () => {
  const { paula, marcos } = accounts
  const cat = (await admin.json('POST', '/api/admin/categories', { name: 'Garantia' }, 201)).category
  await admin.json('POST', '/api/admin/categories', { name: 'garantia' }, 409)
  await admin.json('PATCH', `/api/admin/categories/${cat.id}`, { name: 'Garantia', active: false })
  await marcos.client.json('POST', '/api/protocols', protocolForm(newProtocol({ categoryId: cat.id })), 400)

  // Sequência reconfigurada para um número já usado: avança para o próximo livre.
  await admin.json('PATCH', '/api/admin/settings', { companyName: 'Lar Plásticos', protocolPrefix: 'sac', nextSequence: 3, firstResponseTargetMin: 30, autoAssign: false })
  const p = (await marcos.client.json('POST', '/api/protocols', protocolForm(newProtocol()), 201)).protocol
  assert.equal(p.protocolNumber, `SAC-${new Date().getFullYear()}-00010`)
  assert.equal(p.responsibleId, null)

  const reset = await admin.json('POST', `/api/admin/users/${paula.id}/reset-password`)
  assert.equal((await paula.client.call('GET', '/api/bootstrap')).status, 401, 'sessões antigas caem ao redefinir a senha')
  paula.client = await signIn('paula@larplasticos.com.br', reset.temporaryPassword)

  const me = (await admin.json('GET', '/api/auth/me')).user
  await admin.json('PATCH', `/api/admin/users/${me.id}`, { name: me.name, email: me.email, role: 'agent', isAdmin: false }, 400)
  await admin.json('PATCH', `/api/admin/users/${paula.id}`, { name: 'Paula', email: 'paula@larplasticos.com.br', role: 'seller', teamIds: [teams['Equipe 2']], active: false })
  assert.equal((await paula.client.call('GET', '/api/bootstrap')).status, 401)
  await new Client().json('POST', '/api/auth/login', { email: 'paula@larplasticos.com.br', password: `${reset.temporaryPassword}-nova` }, 401)

  // Tentativas repetidas de senha para a mesma conta são barradas.
  const attempts = await Promise.all(Array.from({ length: 12 }, () =>
    new Client().call('POST', '/api/auth/login', { email: 'rui@larplasticos.com.br', password: 'chute' })))
  assert.ok(attempts.some((r) => r.status === 429))
  assert.equal((await new Client().call('POST', '/api/auth/login', { email: 'ana@larplasticos.com.br', password: 'chute' })).status, 401)

  await marcos.client.json('POST', '/api/auth/logout')
  assert.equal((await marcos.client.call('GET', '/api/bootstrap')).status, 401)
})

test('carteiras: coordenadores e pós-vendas veem só as equipes que acompanham', async () => {
  const [t1, t2, rep] = [teams['Equipe 1'], teams['Equipe 2'], teams['Representação/E-commerce']]
  await admin.json('POST', '/api/admin/users', { name: 'Sem equipe', email: 'sem@larplasticos.com.br', role: 'seller' }, 400)
  await admin.json('POST', '/api/admin/users', { name: 'Duas equipes', email: 'duas@larplasticos.com.br', role: 'seller', teamIds: [t1, t2] }, 400)
  await admin.json('POST', '/api/admin/users', { name: 'Sem equipe', email: 'sem@larplasticos.com.br', role: 'coordinator' }, 400)
  await createAccount('coord1', 'coordinator', { teamIds: [t1] })
  await createAccount('coord2', 'coordinator', { teamIds: [t2] })
  await createAccount('coordrep', 'coordinator', { teamIds: [rep] })
  await createAccount('pos', 'post_sales', { teamIds: [t1, t2] })
  await createAccount('rita', 'seller', { teamIds: [rep] })
  const { coord1, coord2, coordrep, pos, rita, marcos } = accounts
  const visible = async (c: Client) => (await c.json('GET', '/api/bootstrap')).protocols as any[]

  // Protocolos abertos até aqui: 6 do Marcos (Equipe 1) e 4 da Paula (Equipe 2).
  assert.ok((await visible(coord1.client)).every((p) => p.requesterId === marcos.id))
  assert.equal((await visible(coord1.client)).length, 6)
  assert.equal((await visible(coord2.client)).length, 4)
  assert.equal((await visible(coordrep.client)).length, 0)

  const ritaP = (await rita.client.json('POST', '/api/protocols', protocolForm(newProtocol({ teamId: t1 })), 201)).protocol
  assert.equal(ritaP.teamId, rep, 'o vendedor não escolhe a equipe')
  assert.deepEqual((await visible(coordrep.client)).map((p) => p.id), [ritaP.id])
  assert.equal((await visible(coord1.client)).length, 6)

  // Pós-vendas escolhe a equipe, entre as que acompanha.
  await pos.client.json('POST', '/api/protocols', protocolForm(newProtocol()), 400)
  await pos.client.json('POST', '/api/protocols', protocolForm(newProtocol({ teamId: rep })), 400)
  const posP = (await pos.client.json('POST', '/api/protocols', protocolForm(newProtocol({ teamId: t2 })), 201)).protocol
  assert.equal(posP.teamId, t2)
  assert.equal((await visible(pos.client)).length, 11)
  assert.ok((await visible(coord2.client)).some((p) => p.id === posP.id))
  assert.ok(!(await visible(rita.client)).some((p) => p.id === posP.id))

  // Só vendedores e pós-vendas abrem protocolos.
  await coord1.client.json('POST', '/api/protocols', protocolForm(newProtocol({ teamId: t1 })), 403)
  await admin.json('POST', '/api/protocols', protocolForm(newProtocol({ teamId: t1 })), 403)

  // Coordenador responde na carteira, mas não altera status nem vê outras equipes.
  const target = (await visible(coord1.client))[0]
  const form = new FormData()
  form.set('content', 'Coordenação acompanhando este caso.')
  const replied = (await coord1.client.json('POST', `/api/protocols/${target.id}/messages`, form)).protocol
  assert.equal(replied.messages.at(-1).author.role, 'coordinator')
  await coord1.client.json('PATCH', `/api/protocols/${target.id}`, { status: 'fechado' }, 403)
  await coord1.client.json('POST', `/api/protocols/${posP.id}/messages`, form, 404)

  // Trocar a equipe do coordenador muda o que ele enxerga.
  const c1 = (await admin.json('GET', '/api/bootstrap')).users.find((u: any) => u.id === coord1.id)
  await admin.json('PATCH', `/api/admin/users/${coord1.id}`, { ...c1, teamIds: [rep] })
  assert.deepEqual((await visible(coord1.client)).map((p) => p.id), [ritaP.id])

  const team = (await admin.json('POST', '/api/admin/teams', { name: 'Equipe 3' }, 201)).team
  await admin.json('POST', '/api/admin/teams', { name: 'equipe 3' }, 409)
  await admin.json('PATCH', `/api/admin/teams/${team.id}`, { name: 'Equipe 3', active: false })
  await coord1.client.json('POST', '/api/admin/teams', { name: 'X' }, 403)
})

test('itens: abertura com produtos, classificação pelo SAC, listas, catálogo e metas', async () => {
  const { coord2, pos, ana } = accounts
  const t2 = teams['Equipe 2']
  const search = await pos.client.json('GET', '/api/products?q=' + encodeURIComponent('contentor 1000l marrom'))
  assert.ok(search.products.some((p: any) => p.code === '21562'))
  assert.equal((await pos.client.json('GET', '/api/products?q=14531')).products[0].family, 'Cx. Organizadora')

  await pos.client.json('POST', '/api/protocols', protocolForm(newProtocol({ teamId: t2, items: [] })), 400)
  await pos.client.json('POST', '/api/protocols', protocolForm(newProtocol({ teamId: t2, items: [{ productCode: 'nao-existe', quantity: 1 }] })), 400)
  await pos.client.json('POST', '/api/protocols', protocolForm(newProtocol({ teamId: t2, items: [{ productCode: '14531', quantity: 0 }] })), 400)
  await pos.client.json('POST', '/api/protocols', protocolForm(newProtocol({ teamId: t2, customerName: '' })), 400)

  const created = (await pos.client.json('POST', '/api/protocols', protocolForm(newProtocol({
    teamId: t2, items: [{ productCode: '21562', quantity: 3, description: 'Falta plug' }, { productCode: '14531', quantity: 1, description: 'Quebrado' }],
  })), 201)).protocol
  assert.equal(created.customerName, 'PLASTCOMP')
  assert.equal(created.invoiceDate, '2025-11-28')
  assert.deepEqual(created.items.map((i: any) => [i.productCode, i.quantity, i.family, i.failureMode]),
    [['21562', 3, 'Contentor', ''], ['14531', 1, 'Cx. Organizadora', '']])

  const [falta, quebra] = created.items
  const classify = (item: any, over: Record<string, unknown> = {}) => ({
    productCode: item.productCode, quantity: item.quantity, description: item.description,
    location: 'Plug', failureMode: 'FALTA DE COMPONENTE', responsibleArea: 'GESTÃO INJETORA', machinery: 'INJEÇÃO',
    treatment: 'BONIFICADO', commercialConcession: false, costs: { product: 31.5, pickup: 0, shipping: 9.53, postal: 9.53 }, ...over,
  })
  // Quem não é da equipe SAC não classifica, nem na própria carteira.
  await pos.client.json('PUT', `/api/protocols/${created.id}/items/${falta.id}`, classify(falta), 403)
  await coord2.client.json('PUT', `/api/protocols/${created.id}/items/${falta.id}`, classify(falta), 403)
  await ana.client.json('PUT', `/api/protocols/${created.id}/items/${falta.id}`, classify(falta, { failureMode: 'INVENTADO' }), 400)

  let p = (await ana.client.json('PUT', `/api/protocols/${created.id}/items/${falta.id}`, classify(falta))).protocol
  assert.equal(p.items[0].areaCode, '1020001', 'o centro de resultado vem da área')
  assert.deepEqual(p.items[0].costs, { product: 31.5, pickup: 0, shipping: 9.53, postal: 9.53 })
  // Cada item tem a própria tratativa: a quebra vira concessão.
  p = (await ana.client.json('PUT', `/api/protocols/${created.id}/items/${quebra.id}`, classify(quebra, {
    location: 'Corpo', failureMode: 'QUEBRADO', responsibleArea: 'EXPEDIÇÃO', treatment: 'CONCESSÃO APROVADA', commercialConcession: true,
  }))).protocol
  assert.deepEqual(p.items.map((i: any) => i.treatment), ['BONIFICADO', 'CONCESSÃO APROVADA'])
  assert.ok(p.history.some((h: any) => h.kind === 'items' && h.description.startsWith('Item 2 atualizado')))

  p = (await ana.client.json('POST', `/api/protocols/${created.id}/items`, classify(falta, { productCode: '14531', quantity: 2 }))).protocol
  assert.equal(p.items.length, 3)
  p = (await ana.client.json('DELETE', `/api/protocols/${created.id}/items/${p.items[2].id}`)).protocol
  assert.equal(p.items.length, 2)

  p = (await ana.client.json('PATCH', `/api/protocols/${created.id}/details`, {
    customerName: 'PLASTCOMP LTDA', invoiceNumber: '173923', invoiceDate: null, orderNumber: '', saleType: 'B2C',
    unit: 'MATRIZ', returnMethod: 'CORREIOS', returnInvoice: 'N/A',
  })).protocol
  assert.deepEqual([p.customerName, p.saleType, p.unit, p.returnMethod, p.invoiceDate], ['PLASTCOMP LTDA', 'B2C', 'MATRIZ', 'CORREIOS', null])
  await coord2.client.json('PATCH', `/api/protocols/${created.id}/details`, { customerName: 'X', invoiceNumber: '1' }, 403)
  // O coordenador da carteira vê a classificação.
  assert.equal((await coord2.client.json('GET', '/api/bootstrap')).protocols.find((x: any) => x.id === created.id).items[1].treatment, 'CONCESSÃO APROVADA')

  // Listas: opção desativada sai das novas classificações, mas o valor já gravado continua válido.
  const boot = await admin.json('GET', '/api/bootstrap')
  const injetora = boot.lookups.find((l: any) => l.kind === 'area' && l.name === 'GESTÃO INJETORA')
  await admin.json('PATCH', `/api/admin/lookups/${injetora.id}`, { name: injetora.name, code: injetora.code, active: false })
  await ana.client.json('PUT', `/api/protocols/${created.id}/items/${falta.id}`, classify(falta, { quantity: 4 }))
  await ana.client.json('PUT', `/api/protocols/${created.id}/items/${quebra.id}`, classify(quebra), 400)
  await admin.json('POST', '/api/admin/lookups', { kind: 'failure_mode', name: 'quebrado' }, 409)
  await admin.json('POST', '/api/admin/lookups', { kind: 'failure_mode', name: 'Rachado' }, 201)
  await ana.client.json('POST', '/api/admin/lookups', { kind: 'failure_mode', name: 'X' }, 403)

  // Catálogo e metas.
  await admin.json('POST', '/api/admin/products', { code: '14531', name: 'Duplicado' }, 409)
  await admin.json('POST', '/api/admin/products', { code: 'T-1', name: 'PRODUTO TESTE', family: 'Teste' }, 201)
  await admin.json('PATCH', '/api/admin/products/T-1', { name: 'PRODUTO TESTE', family: 'Teste', active: false })
  assert.equal((await pos.client.json('GET', '/api/products?q=T-1')).products.length, 0)
  assert.equal((await admin.json('GET', '/api/admin/products?q=T-1')).products[0].active, false)

  assert.deepEqual(boot.goals.find((g: any) => g.year === 2026), { year: 2026, prevSac: 1933, prevFc: 807, sacReductionPct: 10, fcReductionPct: 20, prevPpm: 237.67, ppmReductionPct: 10 })
  assert.equal(boot.production.filter((m: any) => m.year === 2026).length, 7)
  const production = Array.from({ length: 12 }, (_, i) => (i < 2 ? 500000 + i : null))
  await admin.json('PUT', '/api/admin/goals/2027', { prevSac: 1500, prevFc: 600, sacReductionPct: 10, fcReductionPct: 20, prevPpm: 200, ppmReductionPct: 5, production })
  const after = await coord2.client.json('GET', '/api/bootstrap')
  assert.deepEqual(after.production.filter((m: any) => m.year === 2027), [{ year: 2027, month: 1, kg: 500000 }, { year: 2027, month: 2, kg: 500001 }])
  await coord2.client.json('PUT', '/api/admin/goals/2027', { prevSac: 1, prevFc: 1, sacReductionPct: 1, fcReductionPct: 1, prevPpm: 1, ppmReductionPct: 1, production }, 403)
})
