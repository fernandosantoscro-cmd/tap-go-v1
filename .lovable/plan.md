# TapGo — MVP Fase 1 (fluxo ponta a ponta)

Plataforma que elimina a fila de pagamento: o cliente escaneia o QR do balcão, pede e paga no celular, recebe **um único QR Code** e retira os produtos em qualquer balcão, com saldo atualizado a cada retirada parcial.

## Decisões confirmadas

- **Pagamento:** simulado, mas com jornada realista — tela PIX com QR + "copia e cola", contagem de expiração e confirmação. Nenhum gateway nesta fase; a camada de pagamento fica isolada para plugar PIX real depois.
- **QR real no celular:** os QR Codes são gerados de verdade e abrem URLs públicas reais (`/menu/<codigo>`, `/voucher/<codigo>`), então você escaneia com a câmera do próprio celular e continua o fluxo nele.
- **Funcionário:** entra por **PIN do evento** (sem conta individual), com cargo definido no PIN (atendente, cozinha, bartender, scanner).
- **Identidade:** eu defino — preto/branco/cinza + amarelo #FFC400, muito espaço em branco, tipografia geométrica, sem gradientes.

## Produto 1 — PWA do Cliente (mobile first, sem conta)

1. `/menu/<codigo>` — cardápio do balcão: capa do evento, categorias fixas no topo, cards grandes com preço e tempo de preparo, item indisponível desabilitado.
2. Carrinho em barra fixa inferior (área de toque grande, +/- por item).
3. Checkout: resumo, escolha PIX ou Cartão (Apple/Google Pay visíveis como "em breve", desabilitados).
4. Pagamento: PIX com QR + copia e cola; Cartão com formulário. Confirmação simulada.
5. `/voucher/<codigo>` — **um** QR grande, status do pedido, e por item: comprados / retirados / disponíveis com barra de progresso. Itens de cozinha mostram Recebido → Preparando → Pronto com tempo estimado. Atualiza em tempo real.
6. Botão "Baixar comprovante (PDF)" — estrutura de cupom pronta.
7. PWA instalável (manifest + ícones), sem modo offline nesta fase.

## Produto 2 — Painel do Estabelecimento (desktop/tablet)

- **Conta:** cadastro e login por e-mail/senha do estabelecimento.
- **Dashboard:** pedidos ativos, finalizados, vendido hoje, mais vendidos, tempo médio de preparo e de retirada, gráficos simples.
- **Eventos:** nome, descrição, logo, imagem, data, horário, local, ativo/inativo.
- **Cardápios:** vários por evento, com categorias, ordenação, disponibilidade, horários, imagem e **QR Code exclusivo** (visualizar, baixar PNG, imprimir).
- **Produtos:** nome, imagem, descrição, preço, categoria, tempo de preparo, disponibilidade, estoque opcional.
- **Pedidos:** lista em tempo real, filtro por status, alteração manual Recebido → Preparando → Pronto → Entregue.
- **Retiradas:** histórico de entregas parciais (o quê, quanto, quando, por qual balcão).
- **Scanner (funcional de verdade, desktop e tablet):** abre a webcam do computador (permissão do navegador), mostra o vídeo ao vivo com moldura de mira e lê o QR Code do voucher que você apontar — inclusive o QR aberto na tela do celular. Feedback imediato (som + destaque) ao reconhecer. Botão para trocar de câmera e alternativa de digitação manual do código caso não haja câmera. Ao ler, abre o pedido real, lista saldo disponível por produto, seletor grande [-] N [+] e "Confirmar entrega". Após confirmar, o saldo cai no banco e o voucher no celular atualiza na hora. Saldo zerado mostra "Produto totalmente retirado"; QR segue válido enquanto houver pendência. Todo o ciclo — escanear, entregar parcialmente, escanear de novo, zerar — funciona ponta a ponta com dados reais, só o pagamento é simulado.
- **Funcionários:** nome, cargo, PIN de acesso, permissões por cargo.
- **Relatórios:** vendas por evento/cardápio/produto, exportação CSV.
- **Configurações:** dados do estabelecimento, métodos de pagamento ativos.

## Banco de dados (Lovable Cloud)

Tabelas: `establishments`, `staff`, `events`, `menus`, `categories`, `products`, `orders`, `order_items`, `pickups`, `payment_methods`, `settings`, `logs`, `notifications`.

Regras principais:
- Todo dado do estabelecimento é isolado por `establishment_id` com RLS.
- Leitura pública (anônima) restrita a: cardápio ativo por código e o próprio voucher por código — apenas colunas necessárias, nenhum dado sensível.
- Criação de pedido, pagamento e **retirada parcial** acontecem no servidor: a baixa de saldo é feita numa transação que impede entregar mais do que o comprado, mesmo com dois balcões escaneando ao mesmo tempo.
- Cada retirada grava um registro em `pickups` e um evento em `logs`.
- Dados de demonstração já inseridos (1 estabelecimento, 1 evento, 2 cardápios, ~12 produtos) para você escanear e testar imediatamente.

## Detalhes técnicos

- TanStack Start + React + TypeScript + Tailwind, componentização por domínio (`features/menu`, `features/orders`, `features/scanner`…).
- Rotas públicas com SSR (`/menu/$code`, `/voucher/$code`) para o QR abrir direto; painel sob subárvore autenticada.
- Escrita via server functions com validação Zod; leitura com TanStack Query.
- Tempo real (voucher e painel de pedidos) via Realtime do banco.
- Scanner de câmera com `BarcodeDetector` e fallback em biblioteca JS.
- Acessibilidade: foco visível, contraste AA, alvos de toque ≥ 44px, labels em todos os campos.
- Arquitetura preparada (sem UI) para roadmap: `orders.customer_id` opcional, `payment_methods` extensível, tabela `notifications` para push futuro, `coupons`/carteira previstos no modelo sem expor telas.

## O que não entra nesta fase

Integrações (PDV, ERP, fiscal, iFood, Stone…), login de cliente, cupons, cashback, fidelidade, push, WhatsApp, RFID, multiempresa, multiidioma, IA.
