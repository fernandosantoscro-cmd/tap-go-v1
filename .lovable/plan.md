# TapGo — ajustes de acesso, checkout e retirada parcial

## 1. Entrada única da plataforma
- Homepage: um CTA claro "Acessar plataforma" (mantendo "Cadastrar" como primário do topo).
- Nova tela `/acessar` com dois cartões:
  - **Sou dono** → vai para `/auth` (e-mail + senha, Google, "Esqueci minha senha").
  - **Sou funcionário** → formulário com **código do estabelecimento** + **PIN individual**, entra direto na operação da função dele.
- Cada estabelecimento ganha um código público curto (ex.: `ARENA-4K7Q`), visível no painel em Equipe/Configurações, com botão de copiar. O PIN continua identificando a pessoa.
- Recuperação de senha: link "Esqueci minha senha" com envio de e-mail de redefinição e página `/auth/nova-senha`.

## 2. Botão do Google com identidade correta
- CTA passa a usar o logo oficial multicolorido do Google (SVG inline), fundo branco, texto "Continuar com Google", conforme diretrizes da marca — em login e cadastro.

## 3. Regra de senha
- Mínimo de 6 caracteres, sem bloqueio por complexidade.
- Indicador visual (fraca / média / forte) apenas informativo; o cadastro só é impedido abaixo de 6 caracteres.
- Proteção contra senhas vazadas desativada no backend para não travar o cadastro.

## 4. CPF no checkout + busca por CPF
- Checkout passa a pedir: **Nome (opcional)** e **CPF (obrigatório)**, com máscara e validação de dígitos verificadores.
- O CPF é gravado no pedido (armazenado apenas em dígitos, exibido mascarado no painel: `***.456.789-**`).
- Na operação (fila/scanner) entra a ação **"Buscar pedido"**: funcionário digita o CPF, vê os pedidos ativos daquele CPF, abre um deles, confere os itens e faz a retirada sem QR Code. Fallback para celular sem bateria/perdido.

## 5. Quantidade pronta gradual (mudança de lógica no backend)
- Cada item do pedido passa a controlar quatro números: **comprada**, **em preparo**, **pronta**, **retirada**.
- Balcão marca quantidade: "+1 pronta", "+5 prontas" ou "tudo pronto" — nunca só um status do produto.
- Cliente vê por item:
  ```text
  🍺 Cerveja
  4 prontas para retirada
  6 em preparo
  ```
- Retirada abate da quantidade pronta (10 prontas → retira 3 → 7 disponíveis).
- Regras garantidas no banco: retirada nunca maior que a pronta, pronta nunca maior que a comprada; item vira "entregue" só quando tudo foi retirado.

## 6. Pedido fechado + aba "Meus pedidos"
- Depois de gerar o QR de retirada, o cliente não volta ao cardápio para somar itens no mesmo pedido: o carrinho é encerrado e o cardápio abre um pedido novo.
- Nova aba **"Meus pedidos"** no PWA, listando pedidos salvos no aparelho separados em **Ativos** e **Finalizados/Inválidos**.
- Ao tocar num pedido: QR em tela grande + lista de itens com o status de preparo e as quantidades prontas/em preparo/retiradas atualizando ao vivo.

## 7. Aviso "pronto" em qualquer tela do PWA
- Vibração (onde o navegador suporta) + som curto + **modal pequeno** que aparece em qualquer tela do app:
  ```text
  🔔 Seu pedido está pronto
  🍺 3 cervejas disponíveis para retirada
  [Ver pedido]
  ```
- O aviso passa a ser global (não só na tela do voucher), alimentado pelos pedidos ativos salvos no aparelho.
- Notificação do sistema quando permitida; a área de pedidos continua sempre com o status atualizado, então o aviso nunca é o único caminho.
- Sobre iOS: vibração e notificação em segundo plano são limitadas no Safari. Por isso a combinação (modal in-app + som + notificação quando disponível). Push real em segundo plano exige service worker com push assinado e app instalado na tela de início — proponho como etapa seguinte, não neste ciclo.

## 8. Categorias como filtro no cardápio
- Barra de categorias fixa no topo com scroll horizontal (Bebidas → Comidas → Combos → Promoções) e chip "Todos".
- Ao tocar numa categoria, mostra somente ela; a categoria ativa acompanha o scroll da lista.

## Sugestões extras (posso incluir se aprovar)
- **Retirada por senha curta de 4 dígitos** além do QR e do CPF, para o caso do cliente sem tela nenhuma.
- **Tempo estimado por item** ("pronto em ~8 min") baseado no preparo cadastrado.
- **Painel de balcão em tela cheia (modo TV)** com a fila e o que está pronto aguardando retirada.
- **Alerta de item parado**: item pronto há mais de X minutos sem retirada destacado no balcão.
- **Aviso por WhatsApp** quando o item fica pronto (exige provedor de mensagens e custo por envio).

## Detalhes técnicos
- Migração no banco: `establishments.access_code` (único, com índice); `orders.customer_document` + índice para busca por CPF; `order_items.ready_quantity` com `CHECK` garantindo `delivered_quantity <= ready_quantity <= quantity`.
- Funções seguras novas/atualizadas: `staff_login_by_code(p_code, p_pin)`, `staff_set_ready_quantity(...)`, `find_orders_by_document(p_pin/owner, p_document)`, `register_pickup` validando contra a quantidade pronta, `get_voucher`/`staff_open_orders`/`get_order_pings` devolvendo as quatro quantidades. Grants explícitos para os papéis usados.
- Front: nova rota `/acessar`, `/meus-pedidos`, `/auth/nova-senha`; provider global de avisos no root lendo os pedidos ativos do aparelho; `order-queue`/`pickup-console` com controles de quantidade e busca por CPF; `menu.$code` com barra de categorias; tipos em `tapgo-types.ts` atualizados.
- Auth: `password_hibp_enabled` desligado; validação mínima de 6 caracteres no cliente.
