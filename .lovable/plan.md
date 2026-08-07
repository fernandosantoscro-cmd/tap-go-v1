# TapGo — Fase 2: Painel do Estabelecimento + Fluxo Completo

O fluxo do cliente (cardápio → pagamento simulado → voucher) e o scanner de balcão já funcionam. Falta a ponta que você pediu: criar a conta do estabelecimento, cadastrar tudo e gerar o QR do cardápio — além do controle de "pronto" no PC antes da retirada.

## Fluxo final que vai existir

```text
PC (admin)                          Celular (cliente)             PC (balcão)
criar conta / login
cadastra evento
cadastra cardápio + produtos
imprime/exibe QR do cardápio  ->    escaneia QR
                                    escolhe itens
                                    paga (simulado)
                                    recebe voucher QR
vê pedido chegar, marca "Pronto"
                                                             ->   abre câmera, escaneia
                                                                  voucher, retira itens
```

## O que será construído

**1. Conta e autenticação (`/auth`)**
- Cadastro e login por e-mail/senha + Google.
- No primeiro acesso, criação do estabelecimento (nome, documento opcional), com o usuário como dono.

**2. Painel protegido (`/admin/*`, desktop/tablet)**
- Layout com navegação lateral, isolado por estabelecimento.
- **Visão geral:** pedidos do dia, faturamento, itens pendentes de retirada.
- **Eventos:** criar/editar nome, data, horário, local, ativo.
- **Cardápios:** criar cardápio vinculado a um evento; cada cardápio tem código público e uma tela com **QR Code grande para projetar/imprimir**, link copiável e opção de download.
- **Categorias e produtos:** nome, descrição, emoji, preço, tempo de preparo, estoque, disponibilidade, ordenação.
- **Funcionários:** nome, função, PIN de 4-6 dígitos, ativo/inativo (é o PIN usado no scanner).
- **Formas de pagamento:** ligar/desligar PIX, cartão, "em breve".
- **Pedidos (tempo real):** lista ao vivo por status com detalhe do pedido e botões **Recebido → Preparando → Pronto → Entregue**, por pedido ou por item. É aqui que você marca "pronto" no PC.
- **Relatórios:** faturamento, produtos mais vendidos, retiradas por funcionário, histórico de log.

**3. Ajustes no fluxo existente**
- Formas de pagamento do cardápio passam a respeitar o cadastro do estabelecimento.
- Voucher do cliente mostra "Pronto para retirada" quando o balcão marcar.
- Scanner passa a bloquear/avisar quando o pedido ainda não está pronto (aviso, sem impedir a retirada).

**4. Verificação ponta a ponta**
Teste automatizado no navegador: cria conta, cadastra evento/cardápio/produtos/funcionário, lê o QR gerado, faz pedido, paga, gera voucher, marca pronto no painel e registra a retirada pela câmera.

## Detalhes técnicos

- Rotas protegidas sob `src/routes/_authenticated/admin/*`; `/auth` público.
- CRUD do painel via cliente Supabase autenticado no browser (RLS já isolada por `owns_establishment`), com TanStack Query para cache e invalidação.
- Pedidos em tempo real via Realtime em `orders`/`order_items` (migração para adicionar as tabelas à publicação) com fallback de polling.
- Migração adicional: função para provisionar estabelecimento + formas de pagamento padrão no primeiro login; validação de PIN único por estabelecimento.
- Status do pedido no painel reutiliza `staff_set_status`/novas funções autenticadas, mantendo o log de auditoria.
- Google login exige configuração do provedor no mesmo passo.
