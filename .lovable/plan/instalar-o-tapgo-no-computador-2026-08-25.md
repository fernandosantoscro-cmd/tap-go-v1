# Instalar o TapGo no computador

Sim, é possível. Navegadores de desktop (Chrome, Edge e Brave no Windows, macOS e Linux) instalam o app da mesma forma que o celular — ele abre em janela própria, com ícone na área de trabalho. O que falta hoje é a interface convidar isso: o aviso de instalação atual é um card fixo no rodapé, com texto e visual pensados só para celular.

## O que muda

1. **Detecção de desktop**: o aviso passa a reconhecer se o acesso é de computador ou celular e adapta texto e posição.
   - Desktop: card no canto inferior direito, com texto "Instalar o TapGo no computador — abra o painel em janela própria, sem abas".
   - Celular: mantém o card atual no rodapé.
2. **Botão permanente "Instalar app"** no header da landing page, ao lado de Entrar/Cadastrar, visível apenas quando o navegador permite instalar e o app ainda não está instalado. Assim o usuário pode instalar mesmo depois de fechar o aviso.
3. **Instrução para navegadores sem instalação automática** (Safari no macOS, Firefox): em vez de um botão que não funciona, mostra a orientação curta de usar o menu do navegador — ou simplesmente não exibe nada, evitando falso convite.
4. **Ícone de janela desktop**: adiciona ao manifest as dimensões e `display_override` para janela autônoma, e uma captura de tela larga para o navegador apresentar a instalação corretamente no desktop.

## Detalhes técnicos

- `src/components/install-prompt.tsx`: separar o estado em `platform` (`android` | `ios` | `desktop` | `unsupported`), derivado de user agent e disponibilidade do evento `beforeinstallprompt`; posicionamento condicional (`bottom-3 inset-x-3` no mobile, `bottom-6 right-6 max-w-sm` no desktop). Chave de dispensa passa a ser separada por plataforma para não esconder o aviso do desktop por causa de uma dispensa no celular.
- Extrair um hook `useInstallPrompt()` no mesmo arquivo (ou em `src/hooks/use-install-prompt.ts`) exportando `{ canInstall, install, platform }`, para reuso pelo botão do header.
- `src/routes/index.tsx`: consumir o hook e renderizar o botão "Instalar app" (variante `outline`, ícone `Download`) no header desktop e no menu hambúrguer, condicionado a `canInstall`.
- `public/manifest.webmanifest`: adicionar `display_override: ["window-controls-overlay", "standalone"]`, `categories` e `screenshots` (uma entrada `form_factor: "wide"` e uma `narrow`) apontando para imagens em `public/`.
- Nada de service worker novo: instalação/atalho não exige modo offline, que não foi pedido.

Observação: a instalação só funciona no app publicado (domínio próprio do TapGo), não dentro do preview do editor, porque o preview roda em iframe.
