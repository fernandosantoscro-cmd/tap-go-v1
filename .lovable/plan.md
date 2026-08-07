# Scanner por estabelecimento (multi-bar)

## O que está acontecendo

Confirmei no banco: você tem hoje 4 estabelecimentos, cada um com PIN próprio de balcão
(Bar do Ché, Meu estabelecimento, Bar do Zé, Arena Live Club — PINs diferentes).
O `/scanner` guarda o PIN do último login no navegador e nunca mais pergunta. Então,
quando você cria um bar novo e escaneia o voucher dele, o scanner ainda está logado com
o PIN do bar anterior — daí "Este voucher pertence a outro estabelecimento".

A validação está correta (um balcão não pode dar baixa em voucher de outro bar). O que
falta é deixar claro **qual balcão está aberto** e trocar de balcão em 1 clique.

## O que vou fazer

1. **Mostrar o balcão ativo no scanner**: cabeçalho com o nome do estabelecimento do PIN
   logado, sempre visível, e botão "Trocar balcão" que limpa a sessão e volta à tela de PIN.
2. **Erro de estabelecimento diferente vira ação**: quando o voucher for de outro bar, em vez
   de só avisar, mostro um aviso com o nome do balcão atual e um botão "Trocar de balcão"
   que já leva para a digitação do PIN, mantendo o código lido para reprocessar automaticamente
   depois do novo login.
3. **Atalho no painel**: em Painel > Equipe (e no editor de cardápio), um botão
   "Abrir scanner deste bar" que abre `/scanner` já autenticado com o PIN daquele
   estabelecimento — assim cada bar de teste tem seu scanner certo sem digitar nada.
4. **Sessão inválida se autolimpa**: se o PIN salvo não existir mais (bar apagado, PIN
   regenerado), o scanner detecta na abertura e volta para a tela de PIN em vez de falhar depois.

Resultado: o QR de cada cardápio/voucher funciona no scanner do bar correspondente, e trocar
entre os bares de teste é imediato.

## Detalhes técnicos

- `src/routes/scanner.tsx`: header com `session.establishment`, botão de logout de balcão,
  estado `pendingCode` para reler após troca de PIN, validação da sessão salva ao montar
  (chamada a `staffLogin` com o PIN salvo).
- `/scanner` aceita `?pin=` (via `validateSearch`) para login automático; o PIN é gravado
  no armazenamento local e removido da URL em seguida.
- `src/routes/_authenticated/admin.equipe.tsx` e `admin.cardapios.$menuId.tsx`: link
  "Abrir scanner deste bar" usando o PIN ativo do estabelecimento.
- Sem mudança de schema nem de RLS; `staff_get_order` continua bloqueando vouchers de
  outros estabelecimentos.
