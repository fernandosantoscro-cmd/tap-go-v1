# Scanner sem PIN para o dono logado

## O que está acontecendo

Confirmei no banco: existem contas de proprietário diferentes, cada uma com seu próprio
estabelecimento (Bar do Ché, Meu estabelecimento, Bar do Zé, Arena Live Club). O `/scanner`
hoje exige PIN de funcionário e guarda esse PIN no navegador. Ao criar uma conta nova e testar
o bar dela no mesmo computador, o scanner continua representando o bar anterior — daí
"Este voucher pertence a outro estabelecimento".

Você está certo: para quem já está logado como dono, o PIN não agrega nada — a conta já
identifica o estabelecimento.

## O que vou fazer

1. **Scanner dentro do painel, sem PIN**: nova tela em Painel > Retirada
   (`/admin/retirada`). Ela usa a conta logada para saber qual é o bar, abre a câmera e lê o
   voucher direto — nada de digitar código de acesso. Ao trocar de conta, o bar do scanner
   troca junto, automaticamente.
2. **Retirada total ou parcial** na mesma tela: lista dos itens com saldo, ajuste de
   quantidade e botão "Registrar retirada", com o voucher atualizando na hora.
3. **Voucher de outro bar** mostra um aviso claro ("este voucher é do bar X") em vez de erro
   de tela, e o scanner segue pronto para o próximo QR.
4. **`/scanner` com PIN continua existindo** para funcionário de balcão que não tem login
   (tablet do bar), agora com o nome do bar no topo e botão "Trocar balcão". No painel, o
   atalho "Abrir retirada" leva para a versão sem PIN.
5. **Atalho visível**: link para a tela de retirada no menu do painel e no editor de cardápio.

Resultado: para testar vários bares você só troca de conta e usa Painel > Retirada — cada
cardápio/voucher funciona no seu próprio bar, sem PIN.

## Detalhes técnicos

- Nova função de servidor autenticada (middleware de autenticação) que busca o voucher e
  registra a retirada validando que o pedido pertence ao estabelecimento do usuário logado —
  mesma regra de isolamento de hoje, só sem PIN.
- Nova rota `src/routes/_authenticated/admin.retirada.tsx` reutilizando `QrScanner` e o layout
  de itens já existente no `/scanner`.
- `src/routes/scanner.tsx`: header com o bar ativo, botão de troca de balcão e limpeza da
  sessão local quando o PIN salvo não for mais válido.
- Sem alteração de RLS; as funções existentes de PIN permanecem para o fluxo de balcão.
