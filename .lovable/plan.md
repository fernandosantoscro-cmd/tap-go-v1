# Retirada redonda: um leitor, vínculo sempre pela conta

Você está certo no fundamento: **toda leitura precisa estar vinculada à conta do estabelecimento**. Já é assim hoje — o PIN não é um acesso solto: ele é emitido pela sua conta em Painel > Equipe e o servidor resolve o estabelecimento a partir do PIN, recusando vouchers de qualquer outro bar. O que falta é o nível abaixo: com vários eventos e estandes, o PIN precisa dizer *em qual posto* aquela pessoa está.

Modelo final:

```text
Conta (login do dono)
└── Estabelecimento
    ├── Evento (ex.: Festival Sexta)
    │    ├── Estande/Balcão "Bar Central"  → PIN 4821 (Ana, João)
    │    └── Estande/Balcão "Food Truck"   → PIN 7130 (Bruno)
    └── Cardápios vinculados a cada estande
```

O dono entra com login (acesso total, todos os estandes). O funcionário entra com o PIN daquele estande — credencial emitida pela conta, revogável a qualquer momento, sem dar acesso ao painel.

## O que muda

**1. Estandes/postos de trabalho**
Cada funcionário passa a ter um posto: evento + estande (opcional — sem posto, atende o bar inteiro). O scanner mostra no topo "Bar Central · Festival Sexta" para não haver dúvida de onde a pessoa está trabalhando.

**2. Um único leitor, dois jeitos de entrar**
`/scanner` vira a tela oficial de retirada:
- dono logado entra direto, sem PIN, e pode escolher qual estande está operando;
- sem login, pede o PIN do funcionário;
- `/admin/retirada` continua no painel, mas usando exatamente a mesma tela.

**3. O balcão ganha tudo o que o dono já tinha**
Separação Balcão (imediato) x Cozinha (com preparo), aviso "Em preparo", tempo estimado e botão de marcar item pronto — o funcionário não precisa chamar o dono.

**4. Convidar o funcionário em um clique**
Em Equipe, cada pessoa ganha link pronto de acesso (scanner com PIN preenchido), QR Code desse link, copiar e enviar por WhatsApp. Digitar o PIN à mão continua funcionando.

**5. Fim da sessão velha ("voucher de outro estabelecimento")**
- Ao abrir, o PIN salvo é revalidado no servidor; inválido = sessão limpa com aviso claro.
- Cabeçalho com bar + estande + pessoa e botão "Trocar balcão".
- Login/logout do dono descarta qualquer sessão de PIN antiga no aparelho.

**6. Relatórios por estande**
Retiradas passam a registrar o estande, então Relatórios ganha o corte "por estande/evento" além do já existente por data.

## Detalhes técnicos

- Migração: `staff.event_id uuid null references events(id)` e `staff.station text null` (ou tabela `stations` se preferir cadastro próprio — proponho `station` como texto no MVP para não inflar o cadastro); `staff_login` passa a retornar `event_id`/`station`; `register_pickup` grava `station` em `pickups`.
- `src/components/pickup-console.tsx` (novo): extrai a UI de `admin.retirada.tsx` e recebe por props as funções de servidor (dono: `owner*`; funcionário: `staff*` com PIN) — lógica de grupos única em `voucher-groups.ts`.
- `src/routes/scanner.tsx`: `supabase.auth.getUser()` (client-only) decide modo dono x PIN; revalida PIN salvo via `staffLogin` no mount; lê `?pin=` validado e limpa o parâmetro da URL; limpa `tapgo.staff.*` quando o estabelecimento da sessão mudar.
- `src/lib/tapgo.functions.ts`: mantém `{ voucher, error }`; adiciona `staffSetItemStatus` sobre a RPC `staff_set_status`.
- `admin.equipe.tsx`: seleção de evento/estande no cadastro, link + `<QrCode>` por funcionário; `admin.relatorios.tsx`: agrupamento por estande.
- `admin.retirada.tsx` passa a renderizar `PickupConsole` em modo dono.
