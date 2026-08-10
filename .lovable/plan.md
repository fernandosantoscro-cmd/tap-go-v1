# Fila de preparo antes do scanner

Hoje a retirada começa pelo QR: o atendente só vê o pedido depois de escanear. A mudança traz a **lista de pedidos abertos** para antes da leitura, com botão de "Pronto" por produto, e o celular do cliente reflete cada mudança.

## O que muda na prática

1. **Fila de pedidos (novo bloco no topo da tela de retirada e do scanner do balcão)**
   - Cards com código do pedido, nome/estande, horário do pagamento e valor.
   - Cada produto em uma linha própria: emoji, nome, quantidade, tempo de preparo e status (Recebido / Em preparo / Pronto / Retirado).
   - Botões por produto: **Iniciar preparo** e **Pronto para retirada** (bebidas já entram como prontas).
   - Botão do pedido inteiro: **Marcar tudo pronto**.
   - Separação visual: "Cozinha · em preparo" e "Pronto para retirar".
   - Atualização automática (a cada poucos segundos) para vários atendentes verem o mesmo estado.

2. **Filtros rápidos da fila**
   - Abas: Em preparo · Prontos · Todos os abertos.
   - Quando o funcionário entrou por PIN de um estande, a fila mostra apenas os pedidos daquele estande/evento.

3. **Do lado do cliente (celular)**
   - O voucher já consulta o status periodicamente; o intervalo cai para ~3s e cada item ganha um selo claro: "Em preparo · ~X min", "Pronto para retirar" (com destaque em amarelo) e "Retirado".
   - Aviso no topo quando algo fica pronto: "Seu item está pronto — vá ao balcão".

4. **Scanner continua igual, só depois**
   - O leitor de QR permanece abaixo da fila; ao escanear, o console de retirada abre como hoje, já com os itens prontos pré-selecionados.
   - Também é possível abrir um pedido da fila com um toque no card, sem escanear (útil quando o cliente não acha o QR).

## Detalhes técnicos

- Nova função no banco `staff_open_orders(p_pin)` (security definer) devolvendo pedidos pagos e não concluídos do estabelecimento do PIN, filtrando por `event_id`/`station` quando o PIN tiver posto definido, com itens (status, quantidade entregue, prep_minutes).
- Nova server function `staffListOpenOrders` em `src/lib/tapgo.functions.ts` e `ownerListOpenOrders` em `src/lib/owner-pickup.functions.ts` (esta lendo `orders` + `order_items` via RLS da conta logada).
- Novo componente `src/components/order-queue.tsx`: lista, filtros por status, ações por item e por pedido, `useQuery` com `refetchInterval` e invalidação após cada ação.
- Reuso das ações existentes: `ownerSetItemStatusByCode` / `staffSetItemStatus` para item, e `owner_set_order_status` sem `p_item_id` para o pedido inteiro; adiciono status `preparando` nas opções aceitas.
- `admin.retirada.tsx` e `routes/scanner.tsx` passam a renderizar `OrderQueue` acima do `PickupConsole`, compartilhando um callback `onOpenOrder(code)` que carrega o voucher no console.
- `PickupConsole` ganha uma prop opcional `openCode` para abrir um pedido vindo da fila.
- `voucher.$code.tsx`: intervalo de polling 5s → 3s e banner/selos de status por item.
