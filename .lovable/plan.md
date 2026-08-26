# Plano — Integrações externas (fiscal, pagamento real e plataforma do estabelecimento)

Objetivo: o TapGo passa a conversar com as APIs que o estabelecimento já usa — emissão automática de nota/cupom fiscal após o pagamento, pagamento real via PIX/cartão e uma camada genérica de integração para ERPs/sistemas de gestão.

## 1. Base de dados (migração)

- Nova tabela `establishment_integrations`: uma linha por integração do estabelecimento
  - `provider` (`nfeio`, `focusnfe`, `enotas`, `mercadopago`, `webhook_custom`)
  - `credentials` (JSONB — chaves de API gravadas apenas pelo servidor, nunca lidas pelo navegador)
  - `settings` (JSONB — ambiente homologação/produção, emitir automático, série, natureza da operação)
  - `enabled`, `last_status`, `last_error`
- Nova tabela `fiscal_documents`: documentos emitidos por pedido
  - `order_id`, `provider`, `status` (`pendente`, `emitida`, `erro`, `cancelada`)
  - `number`, `pdf_url`, `xml_url`, `provider_ref`, `error_message`
- Nova tabela `integration_events`: log de chamadas/webhooks (auditoria e retry)
- `orders`: novos campos `fiscal_status` e `payment_provider_ref`
- RLS: dono do estabelecimento lê/edita as próprias integrações e documentos; navegador nunca lê `credentials` (coluna acessível só via função segura no servidor). GRANTs na mesma migração.

## 2. Pagamento real (PIX/cartão)

- Adapter de pagamento no servidor (`src/lib/payments/`) com interface única: `createCharge(order)` e `handleWebhook(payload)`.
- Primeiro provider: **Mercado Pago** (PIX + cartão, o padrão no Brasil; Stripe da Lovable não cobre PIX). O estabelecimento cola seu access token nas configurações (homologação e produção).
- Fluxo: checkout gera a cobrança → tela de pagamento mostra QR PIX real / checkout de cartão → webhook `POST /api/public/webhooks/mercadopago` confirma e chama `confirm_payment` (o fluxo atual de voucher continua igual).
- Modo "simulado" continua existindo por estabelecimento (toggle) para testes sem credenciais.

## 3. Nota fiscal / cupom automático

- Adapter fiscal (`src/lib/fiscal/`) com interface única: `issue(order)`, `cancel(ref)`, `getStatus(ref)`.
- Providers plugáveis: **NFE.io**, **Focus NFe** e **eNotas** (o estabelecimento escolhe o que já usa e cola a API key dele).
- Emissão **automática ao confirmar pagamento**: server fn encadeada após `confirm_payment` — cria `fiscal_documents` como `pendente`, chama o provider, salva número/PDF/XML ou erro com retry manual no painel.
- Voucher do cliente passa a exibir "Nota fiscal / Cupom" com botão de download do PDF (substitui o comprovante em canvas quando houver documento fiscal real).
- Dados fiscais do estabelecimento no onboarding/configurações: CNPJ, inscrição municipal/estadual, regime tributário, CNAE, endereço fiscal.

## 4. Plataforma do estabelecimento (ERP/POS genérico)

- **Webhooks de saída por estabelecimento**: URL configurável que recebe eventos `order.paid`, `order.item_ready`, `order.completed` com assinatura HMAC — qualquer sistema (granito, TOTVS, sistema próprio) pode consumir.
- **API de entrada**: chave de API por estabelecimento + endpoints `/api/public/integrations/orders` (listar pedidos pagos) para a plataforma externa puxar dados.
- Teste de conexão com um clique ("Enviar evento de teste") e log visual das últimas chamadas.

## 5. Painel administrativo

- Nova aba **Integrações** em Configurações: cartões para Pagamento (Mercado Pago), Fiscal (NFE.io/Focus/eNotas) e Webhook/API custom, cada um com status, credenciais, toggle homologação/produção e teste.
- Em Pedidos: badge fiscal por pedido (Emitida / Pendente / Erro) com botão "Reemitir".

## Notas técnicas

- Credenciais de providers ficam server-side (`process.env` ou coluna `credentials` lida só por funções seguras); nunca no bundle do navegador.
- Webhooks externos em `/api/public/webhooks/*` com verificação de assinatura do provider antes de qualquer escrita.
- Tudo roda em server functions TanStack (sem edge functions), compatível com o runtime atual.
- Nada muda para quem não configurar integração: pagamento simulado e comprovante digital continuam funcionando como hoje.

## O que preciso de você depois

1. Qual provider fiscal o estabelecimento piloto usa hoje (NFE.io, Focus NFe, eNotas ou outro) — começo pelo adapter dele.
2. Conta Mercado Pago (mesmo de testes) para o PIX real — sem ela, mantenho o modo simulado ativo.
