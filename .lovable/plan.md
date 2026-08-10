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

**6. Feedback visual de leitura**
Ao ler um QR válido: bip curto, vibração (celular), moldura da câmera fica verde e um selo de check aparece com animação (`animate-scale-in` + `animate-fade-in`). Ao confirmar a retirada: overlay de sucesso em tela cheia com check animado, código do pedido e itens entregues, sumindo em ~1,5s. QR inválido/de outro bar: moldura vermelha e mensagem clara, sem travar a câmera.

**7. Um QR único e funcional por estande**
- Cada estande tem seu próprio cardápio com código público único (já é assim: `menus.code` gerado aleatoriamente) — então cada QR abre só o cardápio daquele estande e os pedidos nascem amarrados a ele.
- Tela "QR Codes" com todos os estandes juntos: QR grande de cada um, código legível, botão de baixar PNG individual, baixar todos e imprimir a folha (um por página, pronto para colar na mesa/balcão).
- Botão "criar estande" que já gera evento + cardápio + código + PIN do balcão, para você montar 2-3 estandes e testar um por um.
- Cada voucher de cliente continua com código único (`orders.code`), então cada compra gera um QR diferente e rastreável.

## Detalhes técnicos

- Migração: `staff.event_id uuid null references events(id)` e `staff.station text null`; `staff_login` retorna `event_id`/`station`; `register_pickup` grava `station`/`menu_id` em `pickups`.
- `src/components/pickup-console.tsx` (novo): extrai a UI de `admin.retirada.tsx`, recebendo por props as funções de servidor (dono: `owner*`; funcionário: `staff*` com PIN) — grupos continuam em `voucher-groups.ts`.
- `src/components/scan-feedback.tsx` (novo): overlay de sucesso/erro (Web Audio para o bip, `navigator.vibrate`, `prefers-reduced-motion` respeitado); `qr-scanner.tsx` ganha prop `feedback` para a cor da moldura.
- `src/routes/scanner.tsx`: `supabase.auth.getUser()` (client-only) decide modo dono x PIN; revalida o PIN salvo via `staffLogin` no mount; lê `?pin=` validado e limpa o parâmetro da URL; descarta `tapgo.staff.*` quando o estabelecimento muda.
- `src/lib/tapgo.functions.ts`: mantém `{ voucher, error }`; adiciona `staffSetItemStatus` sobre a RPC `staff_set_status`.
- `admin.equipe.tsx`: evento/estande no cadastro + link e `<QrCode>` por funcionário; nova rota `admin.qrcodes.tsx` com a folha de QR Codes (usa `QrCode` + download via canvas, como em `receipt.ts`); `admin.relatorios.tsx` agrupa por estande.
- `admin.retirada.tsx` renderiza `PickupConsole` em modo dono.

