# Retirada redonda: dono e funcionário no mesmo scanner

Hoje existem duas telas separadas: `/admin/retirada` (exige login do dono) e `/scanner` (exige PIN). O PIN funciona de verdade — a validação acontece no servidor e o PIN é criado automaticamente ao criar o estabelecimento (visível em Painel > Equipe) — mas o processo não está redondo: a tela do balcão é mais pobre que a do dono, o PIN fica salvo no aparelho e vira sessão "velha" quando você troca de conta, e não existe uma forma fácil de entregar o acesso ao funcionário.

## O que muda

**1. Um único leitor, dois jeitos de entrar**
`/scanner` passa a ser a tela oficial de retirada:
- Se você já está logado como dono, ela entra direto, sem pedir PIN (mostra "Você está como dono de X").
- Se ninguém está logado, pede o PIN do funcionário como hoje.
- `/admin/retirada` continua existindo no painel, mas apenas reaproveitando o mesmo componente — nada de duas experiências diferentes.

**2. O balcão ganha tudo o que o dono já tinha**
A tela do funcionário passa a mostrar a separação Balcão (entrega imediata) x Cozinha (com preparo), o aviso "Em preparo", o tempo estimado e o botão de marcar item como pronto. Assim o funcionário não precisa chamar o dono para nada.

**3. Convidar o funcionário em um clique**
Em Painel > Equipe, cada pessoa ganha:
- um link pronto de acesso (abre o scanner já com o PIN preenchido),
- um QR Code desse link para o funcionário escanear com o celular dele,
- botões de copiar link e enviar por WhatsApp.
O PIN continua sendo digitável manualmente como alternativa.

**4. Fim da sessão velha ("voucher de outro estabelecimento")**
- Ao abrir o scanner, o PIN salvo é revalidado no servidor; se não valer mais, a sessão é limpa automaticamente com aviso claro.
- O cabeçalho mostra sempre bar + nome + função, com botão "Trocar balcão".
- Quando o dono faz login/logout no painel, qualquer sessão de PIN antiga guardada no aparelho é descartada.

**5. Caminhos óbvios na entrada**
- Home: o botão vira "Sou funcionário — entrar com PIN" e o do dono fica destacado.
- Painel: atalho "Abrir scanner deste bar" no topo de Retirada e no dashboard.
- Equipe: texto curto explicando quem usa PIN e quem usa login.

## Detalhes técnicos

- `src/components/pickup-console.tsx` (novo): extrai a UI de leitura/retirada de `admin.retirada.tsx`, recebendo por props as funções de servidor (dono: `owner*`; funcionário: `staff*` com PIN) — sem duplicar lógica de grupos.
- `src/routes/scanner.tsx`: passa a checar `supabase.auth.getUser()` (client-only) para decidir modo dono x PIN, revalida o PIN salvo via `staffLogin` no mount e limpa `tapgo.staff.*` quando inválido ou quando o `establishment` da sessão difere.
- `src/lib/tapgo.functions.ts`: `staffGetOrder`/`registerPickup` mantêm o formato `{ voucher, error }`; adicionar `staffSetItemStatus` (já existe RPC com PIN) para o "marcar pronto" no balcão.
- `src/routes/_authenticated/admin.equipe.tsx`: gera `\${origin}/scanner?pin=<pin>` + `<QrCode>` por funcionário; `scanner.tsx` lê `?pin=` via search params validados, faz login e remove o parâmetro da URL.
- `src/routes/_authenticated/admin.retirada.tsx` passa a renderizar `PickupConsole` em modo dono.
- Sem mudanças de banco: `staff_login`, `staff_get_order`, `register_pickup` e as funções do dono já cobrem tudo.
