-- Esquema inicial do portal de SAC.

CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  email                text NOT NULL,
  phone                text NOT NULL DEFAULT '',
  department           text NOT NULL DEFAULT '',
  title                text NOT NULL DEFAULT '',
  -- requester: abre protocolos · agent: equipe SAC · observer: pode ser colocado em cópia
  role                 text NOT NULL CHECK (role IN ('requester', 'agent', 'observer')),
  is_admin             boolean NOT NULL DEFAULT false,
  active               boolean NOT NULL DEFAULT true,
  password_hash        text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE sessions (
  token_hash   text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_key ON categories (lower(name));

CREATE TABLE settings (
  id                        integer PRIMARY KEY CHECK (id = 1),
  company_name              text NOT NULL,
  protocol_prefix           text NOT NULL,
  next_sequence             integer NOT NULL CHECK (next_sequence >= 1),
  first_response_target_min integer NOT NULL CHECK (first_response_target_min >= 1),
  auto_assign               boolean NOT NULL
);

CREATE TABLE protocols (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_number text NOT NULL UNIQUE,
  title           text NOT NULL,
  description     text NOT NULL,
  type            text NOT NULL CHECK (type IN ('Reclamação', 'Solicitação', 'Dúvida', 'Sugestão', 'Elogio')),
  category_id     uuid NOT NULL REFERENCES categories (id),
  priority        text NOT NULL CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  status          text NOT NULL CHECK (status IN ('novo', 'em_atendimento', 'aguardando_cliente', 'aguardando_terceiro', 'resolvido', 'fechado')),
  location        text NOT NULL DEFAULT '',
  -- Conta que abriu o protocolo; os dados de contato abaixo são os informados no formulário.
  requester_id    uuid NOT NULL REFERENCES users (id),
  requester_name  text NOT NULL,
  requester_email text NOT NULL,
  requester_phone text NOT NULL DEFAULT '',
  responsible_id  uuid REFERENCES users (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz
);
CREATE INDEX protocols_requester_idx ON protocols (requester_id);
CREATE INDEX protocols_responsible_idx ON protocols (responsible_id);
CREATE INDEX protocols_updated_idx ON protocols (updated_at DESC);

CREATE TABLE protocol_observers (
  protocol_id uuid NOT NULL REFERENCES protocols (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (protocol_id, user_id)
);
CREATE INDEX protocol_observers_user_idx ON protocol_observers (user_id);

CREATE TABLE messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq               bigint GENERATED ALWAYS AS IDENTITY,
  protocol_id       uuid NOT NULL REFERENCES protocols (id) ON DELETE CASCADE,
  author_id         uuid NOT NULL REFERENCES users (id),
  author_name       text NOT NULL,
  -- Papel do autor neste protocolo no momento do envio.
  author_role       text NOT NULL CHECK (author_role IN ('requester', 'agent', 'observer')),
  content           text NOT NULL DEFAULT '',
  -- Minutos desde a mensagem anterior (nulo na mensagem de abertura).
  response_time_min double precision,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_protocol_idx ON messages (protocol_id, seq);

CREATE TABLE attachments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq              bigint GENERATED ALWAYS AS IDENTITY,
  protocol_id      uuid NOT NULL REFERENCES protocols (id) ON DELETE CASCADE,
  message_id       uuid REFERENCES messages (id) ON DELETE CASCADE,
  name             text NOT NULL,
  mime_type        text NOT NULL,
  size             bigint NOT NULL,
  storage_key      text NOT NULL UNIQUE,
  uploaded_by_id   uuid NOT NULL REFERENCES users (id),
  uploaded_by_name text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_protocol_idx ON attachments (protocol_id, seq);

CREATE TABLE history_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  protocol_id uuid NOT NULL REFERENCES protocols (id) ON DELETE CASCADE,
  kind        text NOT NULL,
  description text NOT NULL,
  actor       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX history_events_protocol_idx ON history_events (protocol_id, id);

CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title           text NOT NULL,
  body            text NOT NULL,
  protocol_number text NOT NULL,
  read            boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

INSERT INTO settings (id, company_name, protocol_prefix, next_sequence, first_response_target_min, auto_assign)
VALUES (1, 'Lar Plásticos', 'SAC', 1, 30, true);

INSERT INTO categories (name, description) VALUES
  ('Reclamação', 'Problemas e insatisfações relatados pelos clientes'),
  ('Sugestão', 'Ideias de melhoria para produtos e serviços'),
  ('Dúvida', 'Perguntas sobre produtos, uso, garantia e políticas'),
  ('Solicitação', 'Solicitações gerais de clientes'),
  ('Produto', 'Defeitos, qualidade e funcionamento de produtos'),
  ('Entrega', 'Atrasos, avarias e alterações de entrega'),
  ('Financeiro', 'Boletos, cobranças, notas fiscais e reembolsos'),
  ('Comercial', 'Orçamentos, pedidos e condições comerciais'),
  ('Outros', 'Assuntos que não se encaixam nas demais categorias');
