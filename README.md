# Tap & Go Flow

Você é um Product Manager Sênior, UX Designer, Staff Software Engineer e Tech Lead.

Sua missão é desenvolver o MVP completo da startup TapGo.

O objetivo não é criar apenas telas bonitas.

O objetivo é construir um produto real, consistente, escalável e pronto para ser utilizado em um evento piloto.

Todo o projeto deve seguir boas práticas de UX, arquitetura, acessibilidade, escalabilidade, componentização e clean code.

Sobre o TapGo

TapGo é uma plataforma que elimina filas de pagamento em bares, pubs, festivais, arenas, beach clubs, shows e qualquer ambiente onde as pessoas ficam em pé e precisam enfrentar filas apenas para pagar.

O foco NÃO é atendimento em mesas.

Não existe garçom.

Não existe pedido na mesa.

O cliente permanece circulando pelo evento.

O único objetivo do TapGo é eliminar a etapa de pagamento presencial.

Depois disso o cliente apenas apresenta seu QR Code para retirar seus produtos.

Problema

Hoje a jornada é:

Entrar na fila

↓

Esperar

↓

Pagar

↓

Esperar novamente

↓

Retirar

↓

Voltar para o evento

O TapGo elimina completamente a primeira fila.

Fluxo do Cliente

O cliente NÃO cria conta.

O cliente NÃO faz login.

O cliente NÃO instala aplicativo.

Tudo acontece através de um PWA.

Fluxo:

Escaneia o QR Code do estabelecimento

↓

Abre automaticamente o cardápio digital

↓

Escolhe produtos

↓

Realiza o pagamento

↓

Recebe um voucher digital (QR Code)

↓

Acompanha status do pedido

↓

Vai até qualquer balcão habilitado

↓

Funcionário escaneia o QR Code

↓

Entrega os produtos

↓

Sistema atualiza o saldo

↓

Fim.

Modelo de Usuários

Existem apenas dois perfis.

Cliente

Sem cadastro.

Sem login.

Sem aplicativo.

Nunca possui painel.

Apenas acessa o cardápio através do QR Code.

Estabelecimento

É o único que cria conta.

Possui painel administrativo completo.

Pode cadastrar funcionários.

Pode criar eventos.

Pode criar cardápios.

Pode cadastrar produtos.

Pode gerar QR Codes.

Pode acompanhar vendas.

Pode escanear vouchers.

Pode gerenciar pedidos.

MVP

O MVP deve funcionar completamente sem integrações.

Não integrar:

PDV

ERP

Sistema Fiscal

iFood

Anota AI

Stone

Linx

Totvs

Nada.

Toda operação acontece dentro do próprio TapGo.

O objetivo é validar o modelo de negócio.

Stack

React

TypeScript

Tailwind CSS

Supabase

Vite

PWA

Arquitetura Component Based.

Código limpo.

Responsivo.

Design

Inspirado em:

Apple

Stripe

Linear

Airbnb

Vercel

Muito espaço em branco.

Poucas cores.

Muito minimalista.

Paleta:

Branco

Preto

Cinza

Amarelo (#FFC400)

Sem excesso de sombras.

Sem excesso de ícones.

Sem gradientes exagerados.

Visual extremamente premium.

Estrutura do Sistema

Existem dois produtos.

Produto 1

Painel Administrativo.

Desktop.

Tablet.

Produto 2

PWA do Cliente.

Mobile First.

Painel Administrativo

Após criar a conta.

Dashboard.

Eventos.

Cardápios.

Produtos.

Pedidos.

Retiradas.

Scanner.

Funcionários.

Relatórios.

Configurações.

Dashboard

Mostrar:

Pedidos ativos.

Pedidos finalizados.

Valor vendido hoje.

Produtos mais vendidos.

Tempo médio de retirada.

Tempo médio de preparo.

Gráficos simples.

Eventos

Cadastrar evento.

Nome.

Descrição.

Logo.

Imagem.

Data.

Horário.

Local.

Status.

Ativo.

Inativo.

Cardápios

Cada evento pode possuir vários cardápios.

Exemplos.

Bar Principal

Bar Premium

Área VIP

Happy Hour

Festival

O administrador pode:

Alterar nome.

Imagem.

Categorias.

Produtos.

Promoções.

Ordem.

Horários.

Disponibilidade.

Gerar QR Code.

Cada cardápio gera automaticamente um QR Code exclusivo.

Exemplo:

tapgo.com/menu/abc123

Produtos

Cadastrar:

Nome.

Imagem.

Descrição.

Preço.

Categoria.

Tempo médio de preparo.

Disponível.

Indisponível.

Quantidade em estoque (opcional).

Pedido do Cliente

O cliente acessa o cardápio.

Seleciona produtos.

Adiciona ao carrinho.

Visualiza resumo.

Realiza pagamento.

Pagamento

Estruturar interface para:

PIX

Cartão

Apple Pay (futuro)

Google Pay (futuro)

Após confirmação.

Gerar pedido.

Gerar QR Code.

Gerar cupom fiscal (estrutura).

Botão:

Baixar PDF.

Voucher Digital

O cliente recebe apenas UM QR Code.

Nunca gerar vários QR Codes.

Esse QR representa todo o pedido.

Exemplo.

Pedido:

10 Chopps

2 Águas

1 Batata

↓

QR Code

Na tela mostrar.

QR Code grande.

Status.

Itens.

Saldo restante.

Exemplo.

🍺 Chopp

Comprados

10

Retirados

4

Disponíveis

6

██████░░░░

🥤 Água

Compradas

2

Retiradas

0

Disponíveis

2

██░░░░░░░░

🍟 Batata

Status

Preparando

Tempo estimado

5 minutos

Quando pronta.

Mostrar.

Pronto para retirada.

Funcionário

Existe um painel específico.

Scanner sempre aberto.

Escaneia QR.

Abre pedido.

Mostra produtos.

Mostra saldo restante.

Exemplo.

🍺 Chopp

Disponível

6

Selecionar quantidade entregue.

[-]

4

[+]

Botão.

Confirmar entrega.

Após confirmação.

Saldo atualizado.

Cliente recebe atualização instantânea.

Quando saldo chegar em zero.

Mostrar.

Produto totalmente retirado.

O QR permanece válido enquanto existir qualquer produto pendente.

Preparo

No MVP.

O atendente pode alterar manualmente.

Recebido

↓

Preparando

↓

Pronto

↓

Entregue

Quando alterar.

Cliente recebe atualização automaticamente.

Scanner

Modo câmera.

Modo digitação manual.

Pesquisar pedido.

Pesquisar QR.

Muito simples.

Funcionários

Cadastrar.

Nome.

Cargo.

Administrador.

Atendente.

Cozinha.

Bartender.

Scanner.

Permissões.

Banco de Dados

Criar estrutura completa.

Estabelecimentos

Funcionários

Eventos

Cardápios

Categorias

Produtos

Pedidos

ItensPedido

Retiradas

MétodosPagamento

Configurações

Logs

Notificações

UX

Fluxo extremamente rápido.

Pouquíssimos cliques.

Grandes botões.

Ideal para uso em eventos.

Pensar sempre em pessoas andando.

Pouca atenção.

Pouco tempo.

Grandes áreas clicáveis.

Roadmap (não implementar agora)

Preparar arquitetura para futuras funcionalidades:

 Login do cliente.

 Cadastro.

 Histórico de compras.

 Cartões salvos (tokenização).

 Compra em um clique.

 Carteira TapGo.

 Compras antecipadas para eventos.

 Cupons de desconto.

 Cashback.

 Programa de fidelidade.

 Notificações Push.

 Integração com WhatsApp.

 Pulseiras RFID/NFC.

 Integração com PDVs.

 Integração fiscal automática.

 Analytics avançado.

 Multiempresa.

 Multiunidade.

 Multiidioma.

 IA para previsão de demanda.

 Recomendações inteligentes.

Essas funcionalidades não devem aparecer na interface, apenas deixar a arquitetura preparada.

Objetivo

Construir um MVP que possa ser apresentado para investidores e validado em um evento real, com foco absoluto em simplicidade operacional. O TapGo não é um sistema de pedidos para mesas: é uma plataforma que elimina filas de pagamento em ambientes de alto fluxo, permitindo que o cliente faça seu pedido pelo celular, pague rapidamente e retire os produtos apresentando um único QR Code, cujo saldo é atualizado a cada retirada parcial até o consumo total do pedido.

caso tenha duvidas e/ou sugestoes me fale

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://instant-retire.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2ff4f84b-549e-4065-9da3-4fcef841ab76).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
