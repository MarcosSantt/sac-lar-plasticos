export interface FaqItem { q: string; a: string; topic: string }

export const FAQ: FaqItem[] = [
  { topic: 'Protocolos', q: 'Como abro um protocolo de SAC?', a: 'Clique em "Abrir SAC" no menu superior ou em "+ Abrir novo protocolo" na tela inicial. Preencha os dados do solicitante, escolha a categoria e a prioridade, descreva a solicitação e clique em "Abrir protocolo". O número é gerado automaticamente.' },
  { topic: 'Protocolos', q: 'Como acompanho o andamento do meu protocolo?', a: 'Acesse "Meus Protocolos" e clique no protocolo desejado. Na aba Conversa você vê toda a tratativa com a equipe SAC, e na aba Histórico todos os eventos registrados.' },
  { topic: 'Protocolos', q: 'O que significa cada status?', a: 'Novo: aguardando triagem. Em atendimento: a equipe SAC está tratando. Aguardando cliente: precisamos de uma resposta sua. Aguardando terceiro: dependemos de uma área ou parceiro externo. Resolvido: solução entregue. Fechado: protocolo encerrado definitivamente.' },
  { topic: 'Observadores', q: 'O que são observadores?', a: 'Funcionam como pessoas em cópia (CC) de um e-mail. Eles acompanham o protocolo e também podem responder na conversa e enviar anexos.' },
  { topic: 'Observadores', q: 'Posso incluir um observador depois que o protocolo foi aberto?', a: 'Sim. Na tela do protocolo, clique em "+ Adicionar observador" no painel de Participantes.' },
  { topic: 'Anexos', q: 'Quais arquivos posso anexar?', a: 'PDFs, imagens (JPG, PNG), planilhas e documentos de texto, com até 10 MB por arquivo. Anexos podem ser enviados na abertura ou a qualquer momento na conversa.' },
  { topic: 'Prazos', q: 'Qual é o prazo de resposta do SAC?', a: 'Nossa meta é realizar a primeira resposta em até 30 minutos em horário comercial. Cada mensagem da conversa mostra o tempo de resposta, e o painel do protocolo exibe o tempo total e o tempo médio de atendimento.' },
  { topic: 'Prazos', q: 'Como a prioridade é definida?', a: 'Baixa: sem impacto imediato. Média: impacto moderado. Alta: impacta a operação do cliente. Urgente: requer ação imediata, como cobranças indevidas ou riscos de segurança.' },
]
