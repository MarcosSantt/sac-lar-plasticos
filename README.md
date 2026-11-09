# Portal de SAC — Lar Plásticos

Portal interno para abertura e acompanhamento de protocolos de SAC: login por e-mail e senha,
conversa com anexos, observadores, indicadores de tempo de atendimento e área administrativa.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 (site) · Node 22 · Fastify · PostgreSQL 16 (API) · Docker

## Como está organizado

```
src/                 Site (React)
  api/               Cliente HTTP da API
  store/             StoreContext: sessão, dados do portal e ações (todas passam pela API)
  pages/             Login, troca de senha, Início, Abrir SAC, Meus/Todos os Protocolos, Protocolo, FAQ, admin/*
  components/ hooks/ layouts/ utils/ types/
server/              API
  migrations/        Esquema do banco em SQL, aplicado automaticamente na inicialização
  src/
    auth.ts          Senhas (scrypt), sessões por cookie e controle de acesso
    protocols.ts     Regras de negócio dos protocolos
    uploads.ts       Recebimento e validação de anexos
    routes/          auth · protocols · admin
  test/              Testes de ponta a ponta da API
Dockerfile           Imagem única: a API também serve o site compilado
docker-compose.yml   Produção (banco + portal)
docker-compose.dev.yml   Banco para desenvolvimento
```

## Perfis e permissões

Os protocolos são organizados por **equipe** (carteira comercial, cadastrada em Administração › Equipes).
Cada protocolo fica na equipe de quem o abriu; o pós-vendas escolhe a equipe na abertura.

| Perfil | Abre SAC | Protocolos que vê | Dashboard |
|---|---|---|---|
| **Vendedor** (uma equipe) | Sim | Os que abriu | Não |
| **Pós-vendas** (uma ou mais equipes) | Sim | Os que abriu e os das suas equipes | Sim |
| **Coordenador** (uma ou mais equipes) | Não | Os das equipes que coordena | Sim |
| **Equipe SAC** (inclui a coordenação de SAC) | Não | Todos | Sim |
| **Observador** | Não | Apenas aqueles em que foi incluído | Não |
| **Administrador** | Marcação adicional da equipe SAC: gerencia categorias, equipes, observadores, usuários e configurações. | | |

Todos respondem nos protocolos que veem; status e responsável só são alterados pela equipe SAC. O
dashboard mostra apenas os números dos protocolos que a pessoa pode ver.

As permissões são validadas no servidor: quem não tem acesso a um protocolo não consegue lê-lo,
responder nem baixar seus anexos, mesmo chamando a API diretamente.

Não há autocadastro. O administrador cria as contas e o portal gera uma **senha provisória**, exibida
uma única vez; no primeiro acesso a pessoa é obrigada a definir a própria senha. Quem esquecer a senha
pede a um administrador para usar **Redefinir senha**.

## Regras de negócio

- Número de protocolo sequencial `SAC-AAAA-NNNNN` (prefixo e sequência configuráveis), gerado no
  servidor sem repetição mesmo com aberturas simultâneas.
- Distribuição automática para o atendente ativo com menos protocolos em aberto (pode ser desligada).
- Tempo de resposta de cada mensagem = intervalo desde a mensagem anterior.
- Indicadores: tempo total, primeira resposta (com meta de SLA) e tempo médio de resposta do SAC.
- Transições automáticas: resposta do SAC em "Novo" → "Em atendimento"; resposta do solicitante em
  "Aguardando cliente" → "Em atendimento".
- Alteração manual de status e de responsável somente pela equipe SAC, sempre registrada no histórico.
- Notificações no portal: nova resposta, mudança de status, protocolo atribuído e inclusão como observador.
- Anexos de até 10 MB (10 por envio); executáveis, scripts e HTML são recusados.
- Cada SAC tem cliente, nota fiscal, pedido e **itens** (produto do catálogo + quantidade). A equipe SAC
  classifica cada item (modo de falha, área responsável/centro de resultado, local, maquinário, tratativa,
  concessão comercial e custos); cada item tem a própria tratativa.
- Dashboard (aba Monitoramento) no formato do painel FR-134: cada item é uma ocorrência; Top 5 por setor,
  modo de falha, família, produto e cliente, custos por área e modo, e Objetivos e Metas (limites de SAC e
  de falta de componente, PPM pela produção mensal). Listas, produtos, metas e produção são mantidos em
  Administração; os valores iniciais vieram da planilha FR-134 (migrações 004 e 005).

## Instalação no servidor (produção)

Requisitos: Docker com o plugin Compose.

```bash
cp .env.example .env      # preencha DB_PASSWORD, ADMIN_EMAIL e ADMIN_PASSWORD
docker compose up -d --build
```

O portal fica em `http://SERVIDOR:8080` (porta ajustável em `APP_PORT`). Entre com `ADMIN_EMAIL` e
`ADMIN_PASSWORD`; a troca de senha é exigida no primeiro acesso. Depois, em **Administração**,
cadastre as equipes, a equipe SAC, os vendedores, coordenadores, pós-vendas e observadores.

Para atualizar: `git pull && docker compose up -d --build`. As migrações do banco rodam sozinhas.

### HTTPS

Coloque o portal atrás do proxy reverso da empresa (Nginx, Caddy, Traefik, IIS…) com certificado, e
defina no `.env`:

```
COOKIE_SECURE=true
TRUST_PROXY=true
```

Sem HTTPS, as senhas trafegam em texto puro pela rede — use só em rede interna confiável e como etapa provisória.

### Backup

Os dados ficam em dois volumes Docker: `sac_db` (banco) e `sac_uploads` (anexos). Faça cópia dos dois:

```bash
docker compose exec -T db pg_dump -U sac sac | gzip > sac-$(date +%F).sql.gz
docker run --rm -v sac-demo_sac_uploads:/data -v "$PWD":/backup alpine tar czf /backup/anexos-$(date +%F).tar.gz -C /data .
```

(O prefixo do volume é o nome da pasta do projeto; confira com `docker volume ls`.)

## Desenvolvimento

```bash
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL em 127.0.0.1:5433
cp server/.env.example server/.env               # administrador inicial e conexão com o banco
npm install && npm --prefix server install

npm run dev:api    # API em http://localhost:3001
npm run dev        # site em http://localhost:5173 (encaminha /api para a API)
```

Verificações:

```bash
npm run build      # checagem de tipos + build do site
npm run lint
npm run test:api   # testes de ponta a ponta da API (usa um banco temporário no PostgreSQL de desenvolvimento)
```

## Identidade visual

Todas as cores ficam em variáveis CSS no topo de `src/index.css` (`:root`) — é o único lugar com
códigos HEX. O `@theme` do Tailwind aponta para essas variáveis e desativa a paleta padrão.
Logo oficial em `public/logo-lar.png`.

## Limites conhecidos desta versão

- O site carrega de uma vez todos os protocolos que o usuário pode ver e atualiza a cada 20 segundos.
  Funciona bem até alguns milhares de protocolos; acima disso, a listagem deve passar a ser paginada no servidor.
- Notificações apenas dentro do portal (sem e-mail).
- Sem recuperação de senha por e-mail: a redefinição é feita por um administrador.
