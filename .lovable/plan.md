# TapGo — Onboarding, funcionamento, filtros e recibo

Objetivo: tirar a confusão do "QR de outro bar", deixar o cadastro do estabelecimento óbvio desde a criação da conta, e adicionar funcionamento (horários), filtros de data e recibo da compra.

## 1. Fim do "voucher de outro estabelecimento"

Causa: existem dados de demonstração (bar "Arena Live Club") e a landing linka para o cardápio demo. Ao escanear um voucher demo com o PIN do seu bar, o servidor recusa — corretamente.

O que muda:
- Remover os links de demonstração da landing; a home passa a levar só para Entrar / Balcão.
- Scanner: mostrar sempre, no topo, o nome do estabelecimento do PIN logado, e no erro dizer de qual bar é o voucher lido, com botão "trocar PIN".
- Painel > Cardápios: cada QR ganha selo com o nome do bar/evento e botão "Regerar código" (novo code + QR), para invalidar QRs antigos impressos.
- Cardápio e voucher passam a exibir o nome do estabelecimento em destaque, evitando pedido no bar errado.

## 2. Criar conta já pedindo os dados do bar

- Cadastro (`/auth`) com campos: nome do bar, tipo (bar, festival, arena, beach club), CNPJ/CPF (opcional) e responsável.
- Após entrar pela primeira vez, um assistente em 3 passos dentro do painel: dados do bar → horário de funcionamento → primeiro cardápio (com QR pronto para baixar no fim).
- Estabelecimento é criado com esses dados de imediato (sem depender de salvar nome no navegador).

## 3. Funcionamento / abertura do bar

- Nova aba **Painel > Configurações**: horário por dia da semana, fechado/aberto, fuso, pausa de pedidos ("aceitar pedidos" liga/desliga) e mensagem exibida quando fechado.
- Cardápio público respeita isso: fora do horário ou com pedidos pausados, mostra aviso "Fechado agora — reabre às HH:MM" e bloqueia o checkout.
- Indicador Aberto/Fechado sempre visível no topo do painel.

## 4. Filtros de data em todo o sistema

- Componente único de período (Hoje, Ontem, 7 dias, 30 dias, Personalizado) usado em Pedidos, Relatórios e Retiradas/Logs.
- Relatórios: faturamento, ticket médio, mais vendidos e gráficos recalculados pelo período; comparação com período anterior.
- Botão exportar CSV do período em Pedidos e Relatórios.

## 5. Recibo / cupom da compra

- Ao finalizar o pagamento e no voucher: botão **Baixar recibo** (PDF/imagem) e **Compartilhar** (WhatsApp/e-mail via Web Share, com fallback de cópia do link).
- Recibo contém bar, evento, código do pedido, itens, quantidades, valores, forma de pagamento, data/hora e referência do pagamento.
- Observação: é recibo de compra (não NFC-e/SAT fiscal, que exige integração fiscal com certificado). Se quiser cupom fiscal real depois, dá para plugar um emissor.

## 6. Otimizações de usabilidade

- Painel: estados vazios com ação ("Nenhum cardápio ainda → Criar cardápio"), atalhos de QR e PIN visíveis na visão geral.
- Pedidos: colunas por status com contadores e som/badge ao chegar pedido novo.
- Cardápio público: carrinho fixo no rodapé com total, e menos toques até o pagamento.

## Detalhes técnicos

- Migração: colunas de funcionamento em `establishments` (`business_hours jsonb`, `accepting_orders boolean`, `timezone text`, `type text`), com GRANTs e políticas do dono já existentes; RPC `get_menu_by_code` retorna estado aberto/fechado; nova RPC `regenerate_menu_code`; `ensure_my_establishment` aceita tipo/telefone.
- `create_order` valida `accepting_orders` e horário antes de criar o pedido (bloqueio no servidor, não só na UI).
- Filtros de data via search params nas rotas do painel (`?from=&to=`), aplicados nas queries do `admin-db.ts`.
- Recibo gerado no cliente (canvas/HTML → imagem/PDF) a partir do payload de `get_voucher`, sem novo serviço.
- Remoção dos dados demo do fluxo visível (mantidos no banco, apenas não linkados).
