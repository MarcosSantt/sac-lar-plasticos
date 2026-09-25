# SAC Lar Plásticos — Demo funcional

Sistema de gestão de SAC (abertura e acompanhamento de protocolos) para demonstração a clientes.
Frontend puro com persistência em `localStorage` (sem backend).

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router · Lucide React

## Executar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de produção em dist/
npm run preview    # serve o build
```

Para voltar aos dados originais: **Administração › Configurações › Restaurar dados de exemplo**.

## Estrutura

```
src/
  components/  Header, NotificationCenter, Toast, Modal, Sidebar, DashboardCard, ProtocolTable,
               ProtocolCard, StatusBadge, PriorityBadge, StatusSelect, ProtocolTimeline, MessageBubble,
               MessageComposer, AttachmentList, FileDropzone, ParticipantList, ParticipantSelector,
               ProtocolDetails, ProtocolHistory, CategoryManager, ObserverManager...
  pages/       Dashboard, NewProtocol, MyProtocols, AllProtocols, Protocol, Faq, admin/*
  layouts/     MainLayout, AdminLayout
  store/       StoreContext (estado global, regras de negócio e persistência)
  hooks/       useMyProtocols, useProtocolFilters, useFileAttachments, useParticipants
  data/        seed (protocolos, categorias, observadores, usuários), faq
  types/       modelos (Protocol, Message, Observer, Category...)
  utils/       formatação de datas/durações, metadados de status/prioridade, métricas de SLA
```

## Regras implementadas

- Número de protocolo sequencial `SAC-AAAA-NNNNN` (prefixo e sequência configuráveis).
- Distribuição automática para o atendente ativo com menor fila.
- Tempo de resposta de cada mensagem = diferença para a mensagem anterior.
- Painel: tempo total, primeira resposta (com meta de SLA) e tempo médio de resposta do SAC.
- Transições automáticas: resposta do SAC em "Novo" → "Em atendimento"; resposta do cliente em
  "Aguardando cliente" → "Em atendimento".
- Alteração manual de status somente pela equipe SAC, sempre registrada no histórico.
- Notificações quando outra pessoa responde um protocolo.

## Roteiro da demonstração

1. Início: indicadores e "Meus últimos protocolos" (usuário Marcos Souza, solicitante).
2. **Abrir SAC**: clique em "ABRIR PROTOCOLO" vazio para mostrar a validação amigável.
3. Preencha os dados, escolha categoria e prioridade, marque observadores (ex.: Maria Silva e João Santos) e anexe um arquivo.
4. **ABRIR PROTOCOLO** → modal com o número gerado → **Visualizar protocolo**.
5. No compositor, em **Respondendo como**, escolha *Ana Paula Ribeiro — Atendente SAC*.
   Em **Simular horário** escolha *+15 min* e envie: aparece "⏱ Tempo de resposta: 15 min",
   o status muda para "Em atendimento" e chega uma notificação.
6. Responda como *João Santos — Observador* (ex.: *+37 min*) com um anexo: o observador participa da conversa.
7. Mostre o painel direito: métricas, participantes, anexos. Use **+ Adicionar observador**.
8. Status: como solicitante o seletor fica bloqueado. No menu do usuário (canto superior direito),
   **Alternar perfil** → Ana Paula Ribeiro, e altere o status para "Aguardando cliente".
9. Abas **Histórico**, **Participantes**, **Anexos** e **Detalhes**.
10. **Administração › Categorias** → **+ Nova categoria** (ex.: "Garantia").
11. Volte a **Abrir SAC**: a nova categoria já está no select.

> "Simular horário" é um recurso de demonstração que registra a mensagem como se tivesse sido
> enviada depois de um intervalo, para evidenciar o cálculo de tempos ao vivo.

## Identidade visual (Lar Plásticos)

Todas as cores ficam em variáveis CSS no topo de `src/index.css` (`:root`) — é o único lugar com
códigos HEX. O `@theme` do Tailwind aponta para essas variáveis e desativa a paleta padrão.
Logo oficial em `public/logo-lar.png`; favicon é o símbolo de reciclagem recortado do mesmo arquivo.

## Publicação (GitHub Pages)

Online em: https://marcossantt.github.io/sac-lar-plasticos/

Para publicar uma nova versão depois de alterar o código:

```bash
npm run deploy   # gera o build e envia a pasta dist/ para a branch gh-pages
```
