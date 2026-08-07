# Scanner sem PIN + bebidas e comida no mesmo voucher

## O que está acontecendo

Confirmei no banco: existem contas de proprietário diferentes, cada uma com seu próprio
estabelecimento (Bar do Ché, Meu estabelecimento, Bar do Zé, Arena Live Club). O `/scanner`
hoje exige PIN de funcionário e guarda esse PIN no navegador. Ao criar uma conta nova e testar
o bar dela no mesmo computador, o scanner continua representando o bar anterior — daí
"Este voucher pertence a outro estabelecimento".

Você está certo: para quem já está logado como dono, o PIN não agrega nada — a conta já
identifica o estabelecimento.

O banco já guarda, por produto, se ele precisa de preparo e quantos minutos leva, e o status é
controlado item por item. Falta usar isso na experiência: um mesmo voucher pode ter chope
(retirada imediata) e porção (com preparo).

## Parte 1 — Retirada sem PIN

1. **Scanner dentro do painel**: nova tela em Painel > Retirada (`/admin/retirada`). Usa a
   conta logada para saber qual é o bar, abre a câmera e lê o voucher direto — sem digitar
   código de acesso. Ao trocar de conta, o bar do scanner troca junto.
2. **Retirada total ou parcial** na mesma tela: itens com saldo, ajuste de quantidade e botão
   "Registrar retirada", com o voucher atualizando na hora.
3. **Voucher de outro bar** mostra aviso claro ("este voucher é do bar X") em vez de erro de
   tela, e o scanner segue pronto para o próximo QR.
4. **`/scanner` com PIN continua existindo** para funcionário de balcão sem login (tablet do
   bar), agora com o nome do bar no topo e botão "Trocar balcão".

## Parte 2 — Comida com preparo no mesmo QR Code

O voucher é único; o que muda é o ritmo de cada item.

1. **Duas listas no voucher do cliente**: "Retire agora no balcão" (bebidas e itens sem
   preparo) e "Cozinha" (itens com preparo), cada item da cozinha mostrando estado
   (Em preparo / Pronto para retirar) e o tempo estimado do produto. O tempo estimado é
   exibido a partir do momento do pagamento.
2. **Retirada em etapas, sem novo QR**: o cliente retira as bebidas imediatamente e volta com
   o mesmo QR quando a comida ficar pronta. O saldo por item já suporta isso.
3. **Painel de cozinha simples** em Pedidos: os itens que precisam de preparo aparecem
   agrupados com botão "Pronto" por item (além do "Pronto" do pedido inteiro que já existe).
4. **Na tela de retirada**: itens liberados vêm pré-marcados; itens de cozinha ainda em
   preparo aparecem bloqueados com o aviso "ainda em preparo", e o funcionário pode liberar
   manualmente se quiser entregar antes.
5. **Status do pedido coerente**: enquanto houver item de cozinha pendente, o pedido não é
   marcado como entregue; ao zerar todos os saldos, fecha automaticamente (regra que já
   existe no servidor).
6. **No cadastro do produto**: deixar explícito o par "precisa de preparo" + "minutos", com
   texto de ajuda, para o dono configurar comida x bebida sem dúvida.

## Detalhes técnicos

- Nova função de servidor autenticada que busca o voucher e registra a retirada validando que
  o pedido pertence ao estabelecimento do usuário logado — mesmo isolamento de hoje, sem PIN.
- Nova rota `src/routes/_authenticated/admin.retirada.tsx` reutilizando `QrScanner` e o layout
  de itens do `/scanner`.
- O voucher já retorna `requires_prep`, `prep_minutes`, `status` e `available_quantity` por
  item; o agrupamento bebida/cozinha é feito na apresentação, sem mudança de schema.
- Liberar item pronto usa a mudança de status por item já suportada pelas funções existentes.
- `src/routes/scanner.tsx`: bar ativo no topo, troca de balcão e limpeza da sessão local
  quando o PIN salvo não for mais válido.
- Sem alteração de RLS.
