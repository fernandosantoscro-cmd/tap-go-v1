# Navegação mais amigável + visual SaaS moderno

Duas frentes: (1) trocar o aviso de "item pronto" em tela cheia por um pop-up discreto, (2) suavizar o visual do app para ficar menos "quadrado" e mais moderno.

## 1. Aviso de item pronto = pop-up, nunca tela cheia

- Remover o overlay amarelo em tela cheia da tela do voucher.
- Usar **um único componente de aviso** (o mesmo card flutuante que já existe hoje fora da tela do pedido), agora também dentro do voucher:
  - card pequeno, ancorado embaixo no celular e no canto direito no desktop
  - conteúdo: sino + "Pronto para retirada", "3× Chopp Pilsen · pedido ABC123", botão "Ver pedido" e "×" para fechar
  - entrada com leve slide/scale, fecha sozinho em ~10s, empilha até 3 avisos
  - mantém vibração, som e notificação do sistema exatamente como estão
- Na tela do próprio pedido, o botão do aviso rola até o QR em vez de navegar.
- Faixa de "itens prontos" no topo do voucher continua, mas mais leve (sem borda dupla).

## 2. Visual: SaaS moderno, arredondado e leve

- Cantos e superfícies: raio maior nos cards (arredondado suave), bordas mais discretas, sombra suave em vez de traço forte; remover bordas de 2px em destaques (usar fundo suave + sombra).
- Hierarquia: títulos com mais respiro, textos secundários mais claros, menos caixas dentro de caixas na tela do voucher, no cardápio e no painel.
- Botões e chips: pílulas com transição suave no hover/toque; chips de categoria do cardápio em scroll horizontal com estado ativo sólido.
- Estados: skeletons arredondados no lugar de "Carregando…", estados vazios com ícone + frase curta + ação.
- Barra de navegação inferior no PWA do cliente (Cardápio · Meus pedidos), para o cliente não se perder entre voucher e lista de pedidos.
- Painel do estabelecimento: cabeçalho com título + ação principal à direita, cards de métrica mais leves, navegação lateral/superior com item ativo em pílula amarela suave.
- Tudo via tokens do design system (branco/preto/cinza/amarelo #FFC400), sem cor crua nos componentes; dark mode mantido.

## Detalhes técnicos

- `src/components/global-order-alerts.tsx`: aceita avisos vindos do voucher, empilha, auto-dismiss, animação de entrada; passa a ser a única superfície de alerta.
- `src/routes/voucher.$code.tsx`: remove o overlay `fixed inset-0`, encaminha `readyAlert` para o componente global, aplica novo estilo de cards.
- `src/lib/use-order-realtime.ts`: mantém polling/vibração/som/título; sem mudança de lógica de negócio.
- `src/styles.css`: novos tokens de raio e sombra suave (`--shadow-soft`), usados nos cards.
- Ajustes de classes em `menu.$code.tsx`, `meus-pedidos.tsx`, `admin.tsx` e componentes de fila/balcão. Sem mudanças de banco de dados.
