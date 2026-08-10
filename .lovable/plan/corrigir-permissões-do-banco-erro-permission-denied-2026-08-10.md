# Corrigir permissões do banco (erro "permission denied")

## O que está acontecendo

A última rodada de ajustes de segurança tirou a permissão de execução de duas funções internas que o próprio sistema usa em todas as telas do painel:

- `owns_establishment` — é a função que verifica "este dado é do meu estabelecimento?". Todas as regras de acesso de pedidos, cardápios, produtos, equipe, eventos e relatórios dependem dela. Sem permissão, qualquer leitura volta com erro 403 (é o motivo dos erros em série no painel).
- `gen_public_code` — gera o código público do cardápio. Sem permissão, criar cardápio falha com "permission denied for function gen_public_code".

Consequência em cadeia: como nenhum cardápio novo é criado (e nada é listado), ao escanear o QR não existe cardápio publicado para abrir.

Verificado direto no banco: hoje essas duas funções só podem ser executadas por `postgres` e `service_role`.

Além disso, algumas funções do fluxo público estão liberadas somente para visitante anônimo. Quando você mesmo está logado no painel e usa a mesma tela (abrir cardápio pelo celular já logado, retirada, consulta de voucher), a chamada é feita como usuário autenticado e também é negada.

## Correção (uma migração)

1. Liberar execução de `owns_establishment` para `authenticated` — restaura o painel inteiro (pedidos, cardápios, produtos, equipe, eventos, QR Codes, relatórios).
2. Liberar execução de `gen_public_code` para `authenticated` — volta a criar cardápio/código de QR.
3. Liberar as funções do fluxo de compra e balcão também para `authenticated`, além de `anon`: `get_menu_by_code`, `create_order`, `confirm_payment`, `staff_login`, `staff_open_orders`, `staff_get_order`, `staff_set_status`, `establishment_open_state`.
4. Manter bloqueadas de fora as funções que não devem ser chamadas pela API: `gen_unique_staff_pin` e o gatilho interno de avisos.

Nada de RLS muda: o isolamento por estabelecimento continua igual, porque `owns_establishment` continua comparando o dono do registro com o usuário logado. As funções públicas continuam exigindo código do cardápio, código do pedido ou PIN válido.

## Depois da migração

- Recarregar o painel e confirmar que pedidos/cardápios/equipe carregam sem 403.
- Criar um cardápio, adicionar um produto e gerar o QR.
- Escanear o QR no celular e confirmar que o cardápio abre com os produtos.

## Detalhes técnicos

`GRANT EXECUTE ... TO authenticated` nas funções acima. `owns_establishment` é `SECURITY DEFINER` porém invocada dentro das políticas RLS no contexto do chamador, por isso o role `authenticated` precisa de EXECUTE. `gen_public_code` é o `DEFAULT` da coluna `menus.code`, avaliado no contexto do INSERT do usuário, portanto também precisa de EXECUTE para `authenticated`.
