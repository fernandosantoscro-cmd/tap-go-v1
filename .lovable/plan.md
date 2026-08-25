# Vibração + aviso "pronto para retirada" no celular

Sim, é possível — e boa parte já existe na tela do voucher (vibração + notificação do sistema após o cliente autorizar). O que falta é confiabilidade: hoje o aviso só funciona bem com a tela do voucher aberta e visível, e o pedido de permissão fica discreto.

## O que vou melhorar

1. **Pedido de permissão claro e no momento certo**
   - Ao finalizar o pagamento e abrir o voucher, mostrar um bloco em destaque: "Quer ser avisado quando estiver pronto?" com botão "Ativar avisos".
   - Se o cliente recusar, manter um aviso discreto explicando que basta deixar a tela aberta.

2. **Alerta impossível de perder quando o item fica pronto**
   - Vibração em padrão longo (3 pulsos) + som curto de alerta.
   - Notificação do sistema com o nome do item ("Chopp Pilsen está pronto para retirada").
   - Overlay em tela cheia amarelo com o item pronto, número do pedido e botão "Ver QR de retirada" — funciona mesmo sem permissão de notificação.
   - Título da aba passa a piscar "(1) Pronto!" quando a tela está em segundo plano.

3. **Atualização mais rápida e resistente a segundo plano**
   - Reduzir o intervalo de checagem e forçar uma checagem imediata quando a tela volta ao foco (`visibilitychange`), evitando o atraso do navegador em abas ocultas.
   - Manter a consulta segura atual por código do pedido.

4. **Avisos por item, não só do pedido**
   - Cada item marcado como pronto no balcão gera seu próprio alerta, e a lista no celular mostra o status por item (em preparo / pronto / retirado).

## Sugestões adicionais (opcionais, me diga se quer)

- **WhatsApp**: enviar mensagem "seu pedido está pronto" para o número informado na compra. É o canal mais confiável no celular, mas exige uma conta de API de mensagens e custo por mensagem.
- **Push real em segundo plano** (mesmo com o app fechado): exige um service worker de push e chaves VAPID; funciona no Android e, no iPhone, só se o cliente instalar o app na tela de início. Dá para fazer depois como evolução.
- **Painel do balcão**: mostrar se o cliente já ativou os avisos, para o atendente saber se precisa chamar em voz alta.

## Detalhes técnicos

- `src/lib/use-order-realtime.ts`: polling mais curto, checagem no `visibilitychange`, retorno do último evento "pronto" para a UI, som via `AudioContext`, vibração e `document.title` piscando.
- `src/routes/voucher.$code.tsx`: bloco de ativação de avisos em destaque, overlay de "pronto" reaproveitando o componente de feedback animado, status por item na lista.
- Sem mudanças de banco de dados; continua usando a função segura `get_order_pings`.
