# Cadastro correto do estabelecimento + testes com outras pessoas

## O que está acontecendo hoje

1. **Cadastro entra direto no painel**: hoje o botão "Cadastrar" cria a conta e, como a confirmação de e-mail está desativada, a pessoa cai no `/admin` sem nenhum passo de configuração. Não existe um fluxo guiado obrigatório.
2. **"Não foi possível carregar seu estabelecimento" em conta nova (bug confirmado)**: a tabela de estabelecimentos exige o **código de acesso** (usado pelo funcionário para entrar com PIN) e esse campo é obrigatório e sem valor automático. A função que cria o estabelecimento no primeiro login **não preenche esse código**, então a criação falha para qualquer conta nova — foi exatamente o que a outra pessoa viu ao tentar logar. Estabelecimentos antigos já tinham código, por isso só contas novas quebram.

## O que vamos fazer

### 1. Corrigir a criação do estabelecimento (bug bloqueante)
- Gerar automaticamente o código de acesso na criação (formato tipo `BARZE-4KQ2`, único), com valor automático também no banco como rede de segurança.
- Garantir que qualquer conta nova crie: estabelecimento, formas de pagamento padrão e um funcionário "Balcão" com PIN.
- Mensagem de erro na tela passa a mostrar o motivo real, com botões "Tentar novamente" e "Entrar de novo" (já existentes) mantidos.

### 2. Cadastro com processo correto (sem confirmação de e-mail)
Ao concluir o cadastro, em vez de cair direto no painel, a pessoa passa por um **assistente de primeiros passos** obrigatório (não é possível pular), em 4 etapas curtas:

```text
1. Estabelecimento   nome, tipo, WhatsApp, CNPJ/CPF (opcional)
2. Funcionamento     dias/horários e "aceitando pedidos"
3. Cardápio          criar cardápio inicial (em branco, exemplo pronto ou importar CSV/XML)
4. Pronto            QR Code do cardápio + código de acesso e PIN do balcão
```

- Cada etapa salva de imediato; se a pessoa fechar e voltar, retoma de onde parou.
- Após concluir, vai para o painel e o tutorial existente fica disponível como "Rever tutorial".
- Quem já tem estabelecimento configurado não vê o assistente.

### 3. Deixar o teste por outras pessoas redondo
- Senha: mínimo 6 caracteres, sem bloqueio por "senha fraca" (mantém o indicador informativo).
- Cadastro por e-mail/senha e por Google funcionando no mesmo fluxo, e os dados digitados antes do Google (nome do bar etc.) continuam sendo aproveitados.
- Cada conta nova nasce isolada: estabelecimento próprio, cardápio próprio, códigos de QR/acesso/PIN próprios — sem misturar com outros bares de teste.
- Na tela final do assistente, um bloco "Compartilhar para teste" com: link do cardápio + QR, código do estabelecimento e PIN do balcão, e link do balcão para o celular.

## Detalhes técnicos

- Migração no banco: `DEFAULT` gerador para `establishments.access_code` e atualização da função `ensure_my_establishment` para preencher `access_code` (com retentativa em caso de colisão do índice único).
- `src/routes/auth.tsx`: após `signUp` com sessão, marcar `tapgo.setup.pending` e navegar para o assistente em vez de `/admin`.
- Novo `src/routes/_authenticated/admin.primeiros-passos.tsx` (ou dialog bloqueante) usando as funções já existentes de estabelecimento, horários, cardápio e importação CSV/XML.
- `src/routes/_authenticated/admin.tsx`: redirecionar para os primeiros passos enquanto o estabelecimento não tiver nome definido/cardápio criado.
- `src/lib/admin-db.ts`: expor no retorno o `access_code` e o PIN do balcão para a tela final.
- Sem alteração no fluxo do cliente (cardápio, pagamento, voucher, retirada).

Depois de aplicar, é preciso publicar para que outras pessoas testem no endereço público.
