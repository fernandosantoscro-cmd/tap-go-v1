# Scanner por conta e estabelecimento (multi-bar)

## O que está acontecendo

Confirmei no banco: existem contas de proprietário diferentes, cada uma com seu próprio
estabelecimento e PIN de balcão (Bar do Ché, Meu estabelecimento, Bar do Zé e Arena Live
Club). O `/scanner`, porém, guarda no navegador o PIN do último bar utilizado, independente
da conta administrativa atualmente conectada. Ao sair de uma conta, entrar em outra e testar
o novo bar no mesmo computador, o scanner continua representando o bar anterior — daí
"Este voucher pertence a outro estabelecimento".

A validação está correta (um balcão não pode dar baixa em voucher de outro bar). O que
falta é deixar claro **qual balcão está aberto** e trocar de balcão em 1 clique.

## O que vou fazer

1. **Mostrar o balcão ativo no scanner**: cabeçalho com o nome do estabelecimento do PIN
   logado, sempre visível, e botão "Trocar balcão" que limpa a sessão e volta à tela de PIN.
2. **Erro de estabelecimento diferente vira ação**: quando o voucher for de outro bar, em vez
   de só avisar, mostro um aviso com o nome do balcão atual e um botão "Trocar de balcão"
   que já leva para a digitação do PIN, mantendo o código lido para reprocessar automaticamente
   depois do novo login.
3. **Sincronizar com a troca de conta**: ao sair da conta administrativa ou entrar em outra
   conta no mesmo navegador, limpar a sessão local do scanner anterior. Nenhum PIN de outro
   estabelecimento será herdado pela nova conta.
4. **Atalho seguro no painel**: em Painel > Equipe (e no editor de cardápio), um botão
   "Abrir scanner deste bar" abre o scanner e solicita/confirma o PIN daquele estabelecimento,
   sem expor o PIN na URL.
5. **Sessão inválida se autolimpa**: se o PIN salvo não existir mais (bar apagado, PIN
   regenerado), o scanner detecta na abertura e volta para a tela de PIN em vez de falhar depois.

Resultado: o QR de cada cardápio/voucher funciona no scanner do bar correspondente, e trocar
entre os bares de teste é imediato.

## Detalhes técnicos

- `src/routes/scanner.tsx`: header com `session.establishment`, botão de logout de balcão,
  estado `pendingCode` para reler após troca de PIN, validação da sessão salva ao montar
  (chamada a `staffLogin` com o PIN salvo).
- O armazenamento do scanner passa a incluir a identidade do estabelecimento e é invalidado
  quando a conta autenticada muda ou encerra a sessão.
- `src/routes/_authenticated/admin.equipe.tsx` e `admin.cardapios.$menuId.tsx`: ação
  "Abrir scanner deste bar" sem transportar credenciais na URL.
- Sem mudança de schema nem de RLS; `staff_get_order` continua bloqueando vouchers de
  outros estabelecimentos.
