# Corrigir "Não foi possível carregar seu estabelecimento" ao entrar em outro aparelho

## O que já foi verificado

- A tela do painel chama a função de banco `ensure_my_establishment`, que cria/retorna o estabelecimento do dono logado. A função existe e está com permissão correta para usuários autenticados (conferido no banco).
- A função só falha logicamente em um caso: quando é chamada **sem sessão válida** — nesse caso ela responde "Não autenticado".
- Hoje o painel tenta 2 vezes com 0,8s de intervalo e, se falhar, mostra a mensagem genérica "Não foi possível carregar seu estabelecimento", sem dizer o motivo real e sem tentar de novo quando a sessão termina de carregar.

Ou seja: a causa exata no seu aparelho ainda não está confirmada, porque a mensagem atual esconde o erro do servidor. O plano começa exibindo o motivo real e, ao mesmo tempo, elimina a corrida de sessão (cenário mais provável em um aparelho novo, onde o token acaba de ser criado pelo login Google e a chamada sai antes da sessão estar pronta).

## O que muda

1. **Esperar a sessão antes de consultar**
   - A consulta do estabelecimento só dispara depois que o token do usuário está disponível no aparelho.
   - Quando o login muda de estado (entrou, token renovado), a consulta é refeita automaticamente em vez de ficar travada no erro.

2. **Novas tentativas mais tolerantes**
   - Até 4 tentativas com espera crescente, cobrindo rede móvel lenta e o primeiro acesso após o login Google.

3. **Mensagem de erro útil**
   - Em vez da frase genérica, a tela mostra o motivo real (ex.: sessão expirada, sem conexão, erro de permissão) com dois botões: "Tentar novamente" e "Entrar de novo" (que limpa a sessão e volta para o login).

4. **Recuperação automática de sessão expirada**
   - Se o erro indicar falta de autenticação, o app tenta renovar a sessão uma vez; se não conseguir, encaminha para a tela de login em vez de deixar o painel quebrado.

## Detalhes técnicos

- `src/lib/admin-db.ts` → `useEstablishment`: adicionar `enabled` baseado em uma pequena leitura de sessão (`supabase.auth.getSession`) exposta por um hook local, `retry: 4` com `retryDelay` exponencial, e propagar a mensagem do erro do RPC.
- Novo hook leve (em `src/lib/admin-db.ts` ou `src/hooks`) que devolve `hasSession` e escuta `supabase.auth.onAuthStateChange` para invalidar `["establishment"]` em `SIGNED_IN` / `TOKEN_REFRESHED`.
- `src/routes/_authenticated/admin.tsx`: o bloco `establishment.isError` passa a exibir `establishment.error.message` e os botões "Tentar novamente" / "Entrar de novo" (`supabase.auth.signOut()` + navegação para `/auth`).
- Sem mudança de banco: nenhuma migração é necessária; `ensure_my_establishment` e suas permissões permanecem como estão.

## Verificação

- Simular no navegador: acesso ao painel sem sessão (deve ir para login, não mostrar erro) e com sessão válida (carrega normal).
- Confirmar que, ao forçar um erro do RPC, a tela mostra o motivo real e recupera ao clicar em "Tentar novamente".
