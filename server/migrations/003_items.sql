-- Itens reclamados em cada SAC, classificação pela equipe SAC, catálogo de produtos,
-- listas de classificação e metas anuais (painel FR-134).

-- Listas usadas na classificação dos itens, mantidas pelo administrador.
-- area: área responsável (code = centro de resultado) · failure_mode: modo de falha · location: local da peça
-- treatment: tratativa · unit: unidade · machinery: maquinário · return_method: logística de retorno (pós)
CREATE TABLE lookups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL CHECK (kind IN ('area', 'failure_mode', 'location', 'treatment', 'unit', 'machinery', 'return_method')),
  name       text NOT NULL,
  code       text NOT NULL DEFAULT '',
  active     boolean NOT NULL DEFAULT true,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lookups_kind_name_key ON lookups (kind, lower(name));

CREATE TABLE products (
  code   text PRIMARY KEY,
  name   text NOT NULL,
  family text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true
);

-- Dados comerciais informados na abertura e dados de logística definidos pelo SAC.
ALTER TABLE protocols
  ADD COLUMN customer_name  text NOT NULL DEFAULT '',
  ADD COLUMN invoice_number text NOT NULL DEFAULT '',
  ADD COLUMN invoice_date   date,
  ADD COLUMN order_number   text NOT NULL DEFAULT '',
  ADD COLUMN sale_type      text NOT NULL DEFAULT 'B2B' CHECK (sale_type IN ('B2B', 'B2C')),
  ADD COLUMN unit           text NOT NULL DEFAULT '',
  ADD COLUMN return_method  text NOT NULL DEFAULT '',
  ADD COLUMN return_invoice text NOT NULL DEFAULT '';

-- Cada item é uma ocorrência: produto, quantidade e a classificação feita pelo SAC.
-- Os nomes das listas são gravados como texto para o histórico não mudar quando a lista for editada.
CREATE TABLE protocol_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq                   bigint GENERATED ALWAYS AS IDENTITY,
  protocol_id           uuid NOT NULL REFERENCES protocols (id) ON DELETE CASCADE,
  product_code          text NOT NULL,
  product_name          text NOT NULL,
  family                text NOT NULL DEFAULT '',
  quantity              integer NOT NULL CHECK (quantity > 0),
  description           text NOT NULL DEFAULT '',
  location              text NOT NULL DEFAULT '',
  failure_mode          text NOT NULL DEFAULT '',
  responsible_area      text NOT NULL DEFAULT '',
  area_code             text NOT NULL DEFAULT '',
  machinery             text NOT NULL DEFAULT '',
  treatment             text NOT NULL DEFAULT '',
  commercial_concession boolean NOT NULL DEFAULT false,
  cost_product          numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_product >= 0),
  cost_pickup           numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_pickup >= 0),
  cost_shipping         numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_shipping >= 0),
  cost_postal           numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cost_postal >= 0),
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX protocol_items_protocol_idx ON protocol_items (protocol_id, seq);

-- Metas do ano: limites calculados a partir do ano anterior e da redução pretendida.
CREATE TABLE yearly_goals (
  year              integer PRIMARY KEY CHECK (year BETWEEN 2000 AND 2100),
  prev_sac          integer NOT NULL DEFAULT 0 CHECK (prev_sac >= 0),
  prev_fc           integer NOT NULL DEFAULT 0 CHECK (prev_fc >= 0),
  sac_reduction_pct numeric(5, 2) NOT NULL DEFAULT 0 CHECK (sac_reduction_pct BETWEEN 0 AND 100),
  fc_reduction_pct  numeric(5, 2) NOT NULL DEFAULT 0 CHECK (fc_reduction_pct BETWEEN 0 AND 100),
  prev_ppm          numeric(10, 2) NOT NULL DEFAULT 0 CHECK (prev_ppm >= 0),
  ppm_reduction_pct numeric(5, 2) NOT NULL DEFAULT 0 CHECK (ppm_reduction_pct BETWEEN 0 AND 100)
);

-- Plástico produzido no mês (kg), base do PPM de SAC.
CREATE TABLE monthly_production (
  year  integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  kg    numeric(14, 2) NOT NULL CHECK (kg >= 0),
  PRIMARY KEY (year, month)
);

-- Valores de 2026 do painel FR-134.
INSERT INTO yearly_goals (year, prev_sac, prev_fc, sac_reduction_pct, fc_reduction_pct, prev_ppm, ppm_reduction_pct)
VALUES (2026, 1933, 807, 10, 20, 237.67, 10);
INSERT INTO monthly_production (year, month, kg) VALUES
  (2026, 1, 579027), (2026, 2, 564358), (2026, 3, 699330), (2026, 4, 764315),
  (2026, 5, 757893), (2026, 6, 813181), (2026, 7, 854798);
