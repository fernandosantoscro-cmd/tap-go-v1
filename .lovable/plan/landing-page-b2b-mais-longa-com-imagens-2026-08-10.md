# Landing page B2B mais longa, com imagens

Reescrever `/` como página de vendas para donos de bar, festival, arena e beach club. Foco na dor: fila de pagamento = venda perdida. Mantém a identidade atual (preto/branco/cinza + amarelo #FFC400, tipografia geométrica, sem gradientes) e continua em português.

## Estrutura da página (de cima para baixo)

1. **Hero com imagem** — headline "Cada minuto de fila é uma venda que não acontece", subtítulo curto, dois botões (Criar conta do estabelecimento / Abrir scanner do balcão) e imagem grande à direita: público num bar segurando o celular com o voucher na tela.
2. **Faixa de números** — 4 métricas de impacto (ex.: mais pedidos por hora, menos abandono de fila, retirada em segundos, zero app para o cliente). Formuladas como promessa/estimativa, sem inventar estatística de terceiros ou case falso.
3. **O problema da fila** — imagem de fila no balcão + 3 pontos: cliente desiste, atendente vira caixa, pico de evento derruba o faturamento.
4. **Como funciona** — 3 passos (Escaneia / Paga / Retira) com ícones, versão mais explicada que a atual, com imagem do voucher no celular.
5. **Benefícios para o estabelecimento (B2B, seção principal)** — grade de cards: aumenta ticket e giro, libera o caixa, tudo controlado por evento e estande, retirada parcial sem confusão, relatórios e CSV, importação de cardápio, equipe sem conta (PIN por posto).
6. **Benefícios para o cliente final** — bloco secundário e menor, enquadrado como argumento de venda B2B ("seu cliente fica satisfeito"): sem app, sem cadastro, não perde o show, um QR só, status do preparo no celular.
7. **Para quem é** — bares, festivais, arenas, beach clubs, food parks (cards com imagem ou ícone).
8. **Dois produtos, uma operação** — mantém os dois cards atuais (PWA do cliente / Painel), com imagem de dashboard e de celular.
9. **Perguntas frequentes** — accordion: precisa de app? como funciona o pagamento nesta versão? funciona sem internet boa? precisa de máquina nova? quantos balcões?
10. **CTA final** — faixa amarela com "Criar conta do estabelecimento" e link para o scanner de demonstração.
11. **Footer** — mantém, com aviso de pagamentos simulados nesta versão.

## Imagens

Gerar 5–6 imagens em `src/assets` no estilo fotográfico/editorial coerente com a marca (luz noturna de evento, tons neutros com acento amarelo):
- hero: pessoa no evento com voucher no celular
- fila no balcão (o problema)
- balcão entregando pedido com scanner
- voucher/QR no celular em close
- painel do estabelecimento em tablet
- ambiente de festival/arena (para "Para quem é")

Todas com `alt` descritivo e `loading="lazy"` fora do hero.

## Técnico

- Alterações apenas em `src/routes/index.tsx` (mais componentes de seção no mesmo arquivo, ou pequenos componentes em `src/components/landing/` se ficar longo) e novos arquivos de imagem importados como ES module.
- Sem novas cores fora dos tokens de `src/styles.css`; nenhum `text-white`/`bg-black` solto.
- FAQ com o `accordion` já disponível em `@/components/ui`.
- SEO: manter H1 único, atualizar `head()` (title/description/og) para o novo posicionamento B2B e adicionar JSON-LD de `Product`/`FAQPage`.
- Nenhuma mudança de banco, rotas ou lógica de negócio.
