// Gera o SQL de importação da aba "Apontamentos" da planilha FR-134 (controle de SAC).
//   npm run import:fr134 -- "PAINEL PRINCIPAL - CONTROLE E REGISTRO DE SAC 2026.xlsx" > fr134.sql
//   docker compose exec -T db psql -U sac -d sac -v ON_ERROR_STOP=1 < fr134.sql
// Pode ser executado de novo: os protocolos importados antes (número FR134-...) são substituídos.
import ExcelJS from 'exceljs'

const file = process.argv[2]
if (!file) {
  console.error('Informe o caminho da planilha .xlsx.')
  process.exit(1)
}

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(file)
const ws = wb.getWorksheet('Apontamentos')
if (!ws) throw new Error('Aba "Apontamentos" não encontrada.')

type Cell = ExcelJS.CellValue
const raw = (row: ExcelJS.Row, col: string): Cell => {
  const v = row.getCell(col).value
  return v && typeof v === 'object' && 'result' in v ? (v.result as Cell) : v
}
const text = (row: ExcelJS.Row, col: string) => {
  const v = raw(row, col)
  if (v == null || v instanceof Date) return ''
  if (typeof v === 'object') return 'richText' in v ? v.richText.map((r) => r.text).join('').trim() : ''
  return String(v).trim()
}
const num = (row: ExcelJS.Row, col: string) => {
  const v = raw(row, col)
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}
/** Datas do Excel chegam à meia-noite UTC: o dia é o da planilha, sem fuso. */
const day = (row: ExcelJS.Row, col: string) => {
  const v = raw(row, col)
  return v instanceof Date ? v.toISOString().slice(0, 10) : null
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const FIX_MODE: Record<string, string> = { 'FALHA DE PRCESSO': 'FALHA DE PROCESSO', 'DANI CIF': 'DANO CIF' }
const FIX_RETURN: Record<string, string> = { COREEIOS: 'CORREIOS', TRANSPOTADORA: 'TRANSPORTADORA', 'CLIENTE RETIEA': 'CLIENTE RETIRA', ABS: 'ABS EXPRESS' }

/**
 * Data de entrada (coluna F). O painel da planilha agrupa pelas colunas MÊS/ANO; quando a data
 * digitada não cai nesse mês (erros como 2006 ou 2029), usa a data do 1º e-mail ou o dia 15 do mês.
 */
function entryDate(row: ExcelJS.Row): string {
  const month = MONTHS.indexOf(text(row, 'G').toLowerCase().slice(0, 3)) + 1
  const year = num(row, 'H')
  const ym = month && year ? `${year}-${String(month).padStart(2, '0')}` : null
  const f = day(row, 'F')
  const e = day(row, 'E')
  if (!ym) return f ?? e ?? '2026-01-01'
  if (f?.startsWith(ym)) return f
  if (e?.startsWith(ym)) return e
  return `${ym}-15`
}

const q = (v: string | null) => (v == null ? 'NULL' : `'${v.replace(/'/g, "''")}'`)
const n = (v: number) => (Math.round(v * 100) / 100).toFixed(2)

interface Item { code: string; name: string; family: string; quantity: number; description: string; location: string; mode: string; area: string; areaCode: string; machinery: string; treatment: string; concession: boolean; costs: [number, number, number, number] }
interface Header { number: string; created: string; closed: string | null; open: boolean; seller: string; customer: string; invoice: string; invoiceDate: string | null; order: string; saleType: string; unit: string; returnMethod: string; returnInvoice: string; title: string; description: string; items: Item[] }

const protocols = new Map<string, Header>()
let rows = 0
ws.eachRow((row, r) => {
  if (r < 3) return
  const id = text(row, 'A')
  if (!id) return
  rows++
  const created = entryDate(row)
  const desvio = text(row, 'R')
  const item: Item = {
    code: text(row, 'V') || 'SEM-CODIGO',
    name: text(row, 'W') || 'Produto não informado',
    family: text(row, 'AP').startsWith('#') ? '' : text(row, 'AP'),
    quantity: Math.max(1, Math.round(num(row, 'U')) || 1),
    description: desvio,
    location: text(row, 'T'),
    mode: (() => { const m = text(row, 'P').toUpperCase(); return FIX_MODE[m] ?? m })(),
    area: text(row, 'M'),
    areaCode: text(row, 'N'),
    machinery: text(row, 'D'),
    treatment: text(row, 'Y'),
    concession: text(row, 'Q').toLowerCase() === 'sim',
    // Produto, coleta, envio e Correios (o total da planilha é a soma dos quatro).
    costs: [num(row, 'AI'), num(row, 'AJ'), num(row, 'AK'), num(row, 'AH')],
  }
  const existing = protocols.get(id)
  if (existing) { existing.items.push(item); return }
  const open = text(row, 'AG').toLowerCase() !== 'fechado'
  const finished = day(row, 'AD')
  const extra = text(row, 'AF')
  const ret = text(row, 'AB').toUpperCase()
  protocols.set(id, {
    number: `FR134-${id}`,
    created,
    closed: open ? null : finished && finished >= created ? finished : created,
    open,
    seller: text(row, 'AC'),
    customer: text(row, 'K'),
    invoice: text(row, 'I'),
    invoiceDate: day(row, 'J'),
    order: text(row, 'Z'),
    saleType: text(row, 'B') === 'B2C' ? 'B2C' : 'B2B',
    unit: text(row, 'C'),
    returnMethod: FIX_RETURN[ret] ?? ret,
    returnInvoice: text(row, 'AA'),
    title: (desvio || `${item.mode || 'Ocorrência'} · ${item.name}`).slice(0, 120),
    description: [desvio || 'Ocorrência registrada na planilha FR-134.', extra && `Informações adicionais: ${extra}`, `Importado da planilha FR-134 (protocolo ${id}).`].filter(Boolean).join('\n\n'),
    items: [item],
  })
})

const out: string[] = []
out.push(`-- Importação da planilha FR-134: ${protocols.size} protocolos, ${rows} itens. Gerado em ${new Date().toISOString()}.`)
out.push('BEGIN;')
// Conta técnica que fica como "solicitante" dos protocolos importados (o vendedor da planilha vai no nome).
out.push(`INSERT INTO users (name, email, department, title, role, active, password_hash, must_change_password)
SELECT 'Planilha FR-134', 'importacao-fr134@sistema.local', 'SAC', 'Importação', 'seller', false, '!', false
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'importacao-fr134@sistema.local');`)
out.push(`DELETE FROM protocols WHERE protocol_number LIKE 'FR134-%';`)
out.push(`CREATE TEMP TABLE fr134_p (number text, created date, closed date, open boolean, seller text, customer text, invoice text, invoice_date date, order_number text, sale_type text, unit text, return_method text, return_invoice text, title text, description text) ON COMMIT DROP;`)
out.push(`CREATE TEMP TABLE fr134_i (number text, pos int, code text, name text, family text, quantity int, description text, location text, mode text, area text, area_code text, machinery text, treatment text, concession boolean, c_product numeric, c_pickup numeric, c_shipping numeric, c_postal numeric) ON COMMIT DROP;`)
const ps = [...protocols.values()]
for (let i = 0; i < ps.length; i += 500) {
  out.push(`INSERT INTO fr134_p VALUES\n${ps.slice(i, i + 500).map((p) =>
    `(${[q(p.number), q(p.created), q(p.closed), p.open, q(p.seller), q(p.customer), q(p.invoice), q(p.invoiceDate), q(p.order), q(p.saleType), q(p.unit), q(p.returnMethod), q(p.returnInvoice), q(p.title), q(p.description)].join(', ')})`).join(',\n')};`)
}
const items = ps.flatMap((p) => p.items.map((it, pos) => ({ p, it, pos })))
for (let i = 0; i < items.length; i += 500) {
  out.push(`INSERT INTO fr134_i VALUES\n${items.slice(i, i + 500).map(({ p, it, pos }) =>
    `(${[q(p.number), pos, q(it.code), q(it.name), q(it.family), it.quantity, q(it.description), q(it.location), q(it.mode), q(it.area), q(it.areaCode), q(it.machinery), q(it.treatment), it.concession, ...it.costs.map(n)].join(', ')})`).join(',\n')};`)
}
out.push(`
-- Nomes alinhados às listas do portal: área pelo centro de resultado; demais sem diferenciar maiúsculas.
UPDATE fr134_i i SET area = l.name FROM lookups l WHERE l.kind = 'area' AND l.code = i.area_code AND i.area_code <> '';
UPDATE fr134_i i SET location = l.name FROM lookups l WHERE l.kind = 'location' AND lower(l.name) = lower(i.location);
UPDATE fr134_i i SET mode = l.name FROM lookups l WHERE l.kind = 'failure_mode' AND lower(l.name) = lower(i.mode);
UPDATE fr134_i i SET treatment = l.name FROM lookups l WHERE l.kind = 'treatment' AND lower(l.name) = lower(i.treatment);
-- Opções usadas na planilha que ainda não existem nas listas entram como ativas.
INSERT INTO lookups (kind, name, position)
SELECT DISTINCT k.kind, k.name, 999 FROM (
  SELECT 'failure_mode' AS kind, mode AS name FROM fr134_i UNION SELECT 'location', location FROM fr134_i
  UNION SELECT 'treatment', treatment FROM fr134_i UNION SELECT 'machinery', machinery FROM fr134_i
  UNION SELECT 'unit', unit FROM fr134_p UNION SELECT 'return_method', return_method FROM fr134_p
) k WHERE k.name <> '' AND NOT EXISTS (SELECT 1 FROM lookups l WHERE l.kind = k.kind AND lower(l.name) = lower(k.name));

-- Horário de meio-dia (Brasília) para a data não mudar de dia por causa do fuso.
INSERT INTO protocols (protocol_number, title, description, type, category_id, priority, status, location, requester_id, requester_name,
                       requester_email, customer_name, invoice_number, invoice_date, order_number, sale_type, unit, return_method,
                       return_invoice, created_at, updated_at, closed_at)
SELECT p.number, p.title, p.description, 'Reclamação',
       coalesce((SELECT id FROM categories WHERE lower(name) = 'reclamação'), (SELECT id FROM categories ORDER BY created_at LIMIT 1)),
       'media', CASE WHEN p.open THEN 'em_atendimento' ELSE 'fechado' END, '',
       (SELECT id FROM users WHERE email = 'importacao-fr134@sistema.local'), coalesce(nullif(p.seller, ''), 'Não informado'), '',
       p.customer, p.invoice, p.invoice_date, p.order_number, p.sale_type, p.unit, p.return_method, p.return_invoice,
       (p.created + time '12:00') AT TIME ZONE 'America/Sao_Paulo',
       (coalesce(p.closed, p.created) + time '12:00') AT TIME ZONE 'America/Sao_Paulo',
       CASE WHEN p.open THEN NULL ELSE (p.closed + time '12:00') AT TIME ZONE 'America/Sao_Paulo' END
  FROM fr134_p p;

INSERT INTO protocol_items (protocol_id, product_code, product_name, family, quantity, description, location, failure_mode, responsible_area,
                            area_code, machinery, treatment, commercial_concession, cost_product, cost_pickup, cost_shipping, cost_postal, created_at)
SELECT pr.id, i.code, i.name, coalesce(nullif(i.family, ''), pd.family, ''), i.quantity, i.description, i.location, i.mode, i.area,
       i.area_code, i.machinery, i.treatment, i.concession, i.c_product, i.c_pickup, i.c_shipping, i.c_postal, pr.created_at
  FROM fr134_i i JOIN protocols pr ON pr.protocol_number = i.number LEFT JOIN products pd ON pd.code = i.code
 ORDER BY pr.created_at, i.number, i.pos;

INSERT INTO messages (protocol_id, author_id, author_name, author_role, content, created_at)
SELECT id, requester_id, requester_name, 'requester', description, created_at FROM protocols WHERE protocol_number LIKE 'FR134-%';
INSERT INTO history_events (protocol_id, kind, description, actor, created_at)
SELECT id, 'created', 'Protocolo importado da planilha FR-134', 'Sistema', created_at FROM protocols WHERE protocol_number LIKE 'FR134-%';

SELECT count(*) AS protocolos, (SELECT count(*) FROM protocol_items i JOIN protocols p ON p.id = i.protocol_id WHERE p.protocol_number LIKE 'FR134-%') AS itens
  FROM protocols WHERE protocol_number LIKE 'FR134-%';
COMMIT;`)
console.log(out.join('\n'))
console.error(`Planilha lida: ${protocols.size} protocolos, ${rows} itens.`)
