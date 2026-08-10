# Balcão no celular do atendente: convite claro em vez de "Abrir em outro aparelho"

Hoje existe um botão "Abrir em outro aparelho" que só abre `/scanner` numa nova aba. Dentro do preview do editor (dentro de um iframe) essa nova aba é bloqueada — por isso "não abre nada". E mesmo funcionando, ele não explicava nada: em outro aparelho o atendente não está logado na sua conta, então cai numa tela pedindo PIN.

## Como o atendente entra (resposta à sua dúvida)

O atendente **nunca usa seu login**. Ele abre uma tela só de balcão (`/scanner`) e se identifica com o **PIN do posto**, que você emite no painel em Equipe. O PIN é a credencial: o servidor descobre por ele o estabelecimento, o evento e o estande. Ou seja:

- Você (dono, logado): usa Retirada dentro do painel, sem PIN.
- Atendente: recebe um link/QR do posto dele, abre no próprio celular, e a tela do balcão já entra logada naquele estande. Nada de senha, nada de conta.

## O que muda

1. **Trocar o botão confuso por "Passar para o celular"**
   - Abre um painel explicando em uma frase: "O atendente escaneia este QR no celular dele e o balcão abre já no estande escolhido."
   - Seletor de posto (os funcionários/PINs existentes) + botão "Criar posto" se não houver nenhum.
   - Mostra QR grande do link `/scanner?pin=...`, botão **Copiar link**, **Enviar no WhatsApp** e **Baixar QR**.
   - Nada de `target="_blank"`: em vez de tentar abrir aba, o dono copia/escaneia. Também um botão "Abrir aqui" que navega na mesma aba (funciona no preview).

2. **Tela do balcão mais autoexplicativa**
   - No topo de `/scanner` sem sessão: título "Balcão do atendente", uma linha dizendo que o PIN é entregue pelo dono, e o campo de PIN.
   - Quando entra por link com PIN, mostra bem visível o estande/evento em que está operando.

3. **Aviso quando estiver dentro do editor**
   - Se a câmera não puder ser usada no contexto atual, a tela explica: "Abra este link direto no navegador do celular para usar a câmera" com o link pronto para copiar.

## Detalhes técnicos

- `src/routes/_authenticated/admin.retirada.tsx`: remover o `<a target="_blank">` e adicionar um `Dialog` (shadcn) "Passar para o celular", reaproveitando dados de equipe de `src/lib/admin-db.ts` e o componente `QrCode`.
- Novo `src/components/staff-handoff-dialog.tsx`: lista de postos (staff ativos com PIN, estande/evento), QR + link `${window.location.origin}/scanner?pin=<pin>`, copiar/WhatsApp/baixar PNG, e atalho para `/admin/equipe`.
- Mesmo botão passa a existir no cabeçalho de `/admin/qrcodes` (onde os estandes são criados), para o dono achar sem procurar.
- `src/routes/scanner.tsx`: melhorar textos do estado `login` (explicação de origem do PIN) e do cabeçalho com sessão (estande/evento em destaque); detectar `window.self !== window.top` para mostrar o aviso de abrir fora do editor.
- Sem mudança de banco: PIN, estande e evento já existem em `staff`.
