-- Equipes (carteiras comerciais) e novos perfis de acesso.

CREATE TABLE teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX teams_name_key ON teams (lower(name));

-- Vendedor: exatamente uma equipe · coordenador e pós-vendas: as equipes que acompanham.
CREATE TABLE user_teams (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams (id),
  PRIMARY KEY (user_id, team_id)
);
CREATE INDEX user_teams_team_idx ON user_teams (team_id);

-- Carteira à qual o protocolo pertence, gravada na abertura.
ALTER TABLE protocols ADD COLUMN team_id uuid REFERENCES teams (id);
CREATE INDEX protocols_team_idx ON protocols (team_id);

-- seller: vendedor · post_sales: pós-vendas · coordinator: coordenador comercial
-- agent: equipe SAC · observer: pode ser colocado em cópia
ALTER TABLE users DROP CONSTRAINT users_role_check;
UPDATE users SET role = 'seller' WHERE role = 'requester';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('seller', 'post_sales', 'coordinator', 'agent', 'observer'));

-- Papel do autor dentro do protocolo (requester = quem abriu).
ALTER TABLE messages DROP CONSTRAINT messages_author_role_check;
ALTER TABLE messages ADD CONSTRAINT messages_author_role_check CHECK (author_role IN ('requester', 'agent', 'observer', 'coordinator', 'post_sales'));

INSERT INTO teams (name) VALUES ('Equipe 1'), ('Equipe 2'), ('Representação/E-commerce');
