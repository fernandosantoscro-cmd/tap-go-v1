import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Clock,
  FileSpreadsheet,

  Layers,
  Menu,
  Moon,
  QrCode as QrCodeIcon,
  ScanLine,
  Smartphone,
  Sun,
  Timer,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { InstallButton } from "@/components/install-button";


import heroImg from "@/assets/lp-hero.jpg";
import filaImg from "@/assets/lp-fila.jpg";
import balcaoImg from "@/assets/lp-balcao.jpg";
import voucherImg from "@/assets/lp-voucher.jpg";
import painelImg from "@/assets/lp-painel.jpg";
import eventoImg from "@/assets/lp-evento.jpg";

const faq = [
  {
    q: "O cliente precisa baixar algum aplicativo?",
    a: "Não. Ele aponta a câmera do celular para o QR Code do balcão, o cardápio abre no navegador e o voucher de retirada também. Sem download, sem cadastro, sem senha.",
  },
  {
    q: "Como funciona o pagamento nesta versão?",
    a: "Nesta versão de validação o pagamento é simulado, com a jornada completa (PIX com QR e copia e cola, ou cartão). A camada de pagamento está isolada para plugar o provedor real sem refazer o fluxo.",
  },
  {
    q: "Preciso comprar maquininha ou equipamento novo?",
    a: "Não. O cliente usa o celular dele. O balcão usa qualquer celular, tablet ou computador com câmera para ler o voucher e dar baixa nos itens.",
  },
  {
    q: "Meus atendentes precisam de conta e senha?",
    a: "Não. Cada posto de trabalho tem um PIN. O atendente abre o link do posto, informa o PIN e já está operando o balcão — a conta é só do estabelecimento.",
  },
  {
    q: "Funciona com vários balcões e estandes ao mesmo tempo?",
    a: "Sim. Cada estande tem seu próprio QR Code e o cliente pode retirar em qualquer balcão. A baixa de saldo é feita no servidor, então dois balcões não conseguem entregar o mesmo item duas vezes.",
  },
  {
    q: "E comida, que tem tempo de preparo?",
    a: "Bebida sai na hora e comida entra na fila de preparo. O atendente marca item por item como pronto e o cliente vê o status mudando no celular, tudo no mesmo voucher.",
  },
];

const numbers = [
  { value: "0", label: "apps para o cliente baixar" },
  { value: "~15s", label: "para pedir e pagar pelo celular" },
  { value: "1", label: "QR Code para todas as retiradas" },
  { value: "100%", label: "das retiradas registradas por estande" },
];

const b2bBenefits = [
  {
    icon: TrendingUp,
    title: "Mais pedidos por hora",
    text: "Quem não enfrenta fila pede de novo. O cliente compra sentado, andando ou assistindo ao show, e o giro do balcão deixa de ser limitado pelo caixa.",
  },
  {
    icon: Wallet,
    title: "O caixa deixa de ser gargalo",
    text: "Sem dinheiro, sem troco, sem fila no cartão. A equipe do balcão volta a fazer o que gera venda: montar e entregar pedido.",
  },
  {
    icon: Layers,
    title: "Retirada parcial sem confusão",
    text: "O cliente compra 6 itens e retira 2 agora, 4 depois. O saldo cai a cada entrega, no servidor, sem risco de entregar duas vezes.",
  },
  {
    icon: Boxes,
    title: "Controle por evento e estande",
    text: "Cada evento tem seus cardápios, cada estande tem seu QR Code. Você sabe o que vendeu e o que saiu em cada posto de trabalho.",
  },
  {
    icon: BarChart3,
    title: "Relatórios e exportação",
    text: "Vendas por evento, cardápio e produto, tempo médio de preparo e de retirada, filtros por data e exportação em CSV para a contabilidade.",
  },
  {
    icon: Users,
    title: "Equipe sem burocracia",
    text: "Atendente entra por PIN do posto, sem conta e sem treinamento longo. Você abre um estande novo em minutos.",
  },
  {
    icon: FileSpreadsheet,
    title: "Cardápio em minutos",
    text: "Importe seus produtos de CSV ou XML, com criação automática de categorias. Preço, foto, tempo de preparo e disponibilidade em um lugar.",
  },
  {
    icon: Clock,
    title: "Fila de preparo organizada",
    text: "Bebida imediata e comida em preparo convivem no mesmo pedido. O atendente marca pronto item por item e o cliente acompanha em tempo real.",
  },
];

const clientBenefits = [
  "Não perde o show numa fila de 20 minutos",
  "Não precisa instalar app nem criar conta",
  "Um QR Code só para tudo que comprou",
  "Vê no celular quando o pedido está pronto",
  "Retira em qualquer balcão, na hora que quiser",
  "Comprovante digital para baixar ou enviar",
];

const audiences = [
  { title: "Bares e casas noturnas", text: "Pico de pedido no intervalo, sem travar o balcão." },
  { title: "Festivais e food parks", text: "Vários estandes, um voucher, tudo rastreado." },
  { title: "Arenas e estádios", text: "Intervalo curto e público grande sem perder venda." },
  { title: "Beach clubs e eventos privados", text: "Consumo espalhado pelo espaço, sem caixa central." },
];

const steps = [
  {
    icon: QrCodeIcon,
    title: "1. Escaneia",
    text: "O cliente aponta a câmera para o QR Code do balcão, da mesa ou do estande. O cardápio do evento abre no navegador dele.",
  },
  {
    icon: Timer,
    title: "2. Paga",
    text: "Escolhe os itens e paga pelo celular em segundos, sem fila, sem troco e sem depender de um atendente livre.",
  },
  {
    icon: ScanLine,
    title: "3. Retira",
    text: "Mostra um único QR Code no balcão. O atendente lê, entrega o que quiser e o saldo cai na hora nos dois lados.",
  },
];

const navLinks = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#beneficios", label: "Benefícios" },
  { href: "#publico", label: "Para quem é" },
  { href: "#faq", label: "FAQ" },
];

function useThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("tapgo.theme");
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("tapgo.theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  };

  return { theme, toggle };
}

function ThemeToggle() {
  const { theme, toggle } = useThemeToggle();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function LandingHeader() {
  const [open, setOpen] = useState(false);

  const handleNav = (href: string) => {
    setOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#inicio" className="font-display text-xl font-semibold tracking-tight">
          Tap<span className="text-primary">Go</span>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => handleNav(item.href)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <InstallButton className="hidden sm:inline-flex" />
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link to="/auth">Entrar</Link>
          </Button>

          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/auth" search={{ mode: "signup" }}>
              Cadastrar
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent md:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-background md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-6 py-2">
            {navLinks.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => handleNav(item.href)}
                className="border-b border-border py-3 text-left text-sm text-foreground last:border-0"
              >
                {item.label}
              </button>
            ))}
            <InstallButton className="my-3 w-full" />
            <div className="mb-3 flex gap-2">
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button asChild size="sm" className="flex-1">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Cadastrar
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TapGo — Acabe com a fila e venda mais no seu evento" },
      {
        name: "description",
        content:
          "Sistema de pedido e retirada por QR Code para bares, festivais, arenas e beach clubs: mais pedidos por hora, caixa livre e cliente satisfeito. Sem app para o público.",
      },
      { property: "og:title", content: "TapGo — Acabe com a fila e venda mais no seu evento" },
      {
        property: "og:description",
        content:
          "Cada minuto de fila é uma venda que não acontece. Com o TapGo o cliente pede e paga pelo celular e retira com um único QR Code.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main>
        {/* Hero */}
        <section id="inicio" className="mx-auto max-w-6xl px-6 pb-16 pt-14 md:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="mb-6 inline-flex items-center rounded-full border px-3 py-1 text-xs tracking-wide text-muted-foreground">
                Para bares, festivais, arenas e beach clubs
              </p>
              <h1 className="max-w-2xl text-4xl leading-[1.05] font-semibold md:text-6xl">
                Cada minuto de fila é uma venda que <span className="text-primary">não acontece</span>.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                O TapGo tira o pagamento do balcão: o cliente pede e paga pelo celular e retira os produtos
                apresentando um único QR Code. Seu balcão só entrega — e entrega mais.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg" className="tap-target">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Cadastrar meu estabelecimento
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="tap-target">
                  <Link to="/auth">Entrar</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Grátis para testar no seu próximo evento piloto. Pagamentos simulados nesta versão.
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border">
              <img
                src={heroImg}
                alt="Cliente em um evento noturno mostrando o voucher com QR Code na tela do celular"
                width={1408}
                height={1056}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Números */}
        <section className="border-y bg-secondary/40">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {numbers.map((item) => (
              <div key={item.label}>
                <p className="font-display text-3xl font-semibold md:text-4xl">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Problema */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border">
              <img
                src={filaImg}
                alt="Fila longa de pessoas esperando para pagar no balcão de um bar à noite"
                width={1200}
                height={912}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-medium tracking-wide text-primary">O problema</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
                A fila não atrasa o cliente. Ela reduz o seu faturamento.
              </h2>
              <ul className="mt-8 space-y-6">
                <li>
                  <h3 className="font-semibold">O cliente desiste da segunda rodada</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Ele compra uma vez, olha a fila e não volta. O consumo médio por pessoa cai justamente no
                    horário de pico.
                  </p>
                </li>
                <li>
                  <h3 className="font-semibold">Seu atendente virou caixa</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Metade do tempo dele é cobrança, troco e maquininha travando. Sobra pouco tempo para montar
                    e entregar pedido.
                  </p>
                </li>
                <li>
                  <h3 className="font-semibold">Você não sabe o que perdeu</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Sem registro por estande e por produto, o pico vira estimativa. Fica difícil dimensionar
                    equipe e estoque para o próximo evento.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="border-t bg-secondary/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm font-medium tracking-wide text-primary">Como funciona</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-4xl">
              Três passos, nenhum aplicativo, nenhuma fila.
            </h2>
            <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div className="grid gap-8 sm:grid-cols-3">
                {steps.map((step) => (
                  <div key={step.title}>
                    <step.icon className="size-6 text-primary" aria-hidden />
                    <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-hidden rounded-2xl border">
                <img
                  src={voucherImg}
                  alt="Close do celular exibindo o voucher de retirada com QR Code único"
                  width={1200}
                  height={1200}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Benefícios B2B */}
        <section id="beneficios" className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-medium tracking-wide text-primary">Para o seu negócio</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-4xl">
            Vender mais no mesmo espaço, com a mesma equipe.
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {b2bBenefits.map((item) => (
              <article key={item.title} className="rounded-2xl border p-6">
                <item.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border">
            <img
              src={balcaoImg}
              alt="Atendente entregando um drink e lendo o QR Code do celular do cliente com um tablet"
              width={1200}
              height={912}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        {/* Benefícios do cliente final */}
        <section className="border-y bg-secondary/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-medium tracking-wide text-primary">E do lado do público</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
                Cliente satisfeito volta ao balcão — e isso é receita sua.
              </h2>
              <p className="mt-4 text-muted-foreground">
                A experiência do público é o seu argumento comercial: menos atrito, menos reclamação na porta e
                mais consumo por pessoa.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {clientBenefits.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-xl border bg-background p-4 text-sm">
                  <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Para quem é */}
        <section id="publico" className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-semibold md:text-4xl">Feito para operações de pico.</h2>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="overflow-hidden rounded-2xl border">
              <img
                src={eventoImg}
                alt="Público em um festival ao ar livre entre estandes de bebida e comida iluminados"
                width={1200}
                height={848}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {audiences.map((item) => (
                <article key={item.title} className="rounded-2xl border p-6">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Dois produtos */}
        <section className="border-t bg-secondary/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-3xl font-semibold md:text-4xl">Dois produtos, uma operação.</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <article className="overflow-hidden rounded-2xl border bg-background">
                <img
                  src={voucherImg}
                  alt="Celular do cliente com o cardápio e o voucher digital do TapGo"
                  width={1200}
                  height={1200}
                  loading="lazy"
                  className="h-56 w-full object-cover"
                />
                <div className="p-8">
                  <h3 className="text-xl font-semibold">PWA do cliente</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Cardápio, carrinho, pagamento e voucher digital. Feito para quem está em pé, com pouco tempo
                    e pouca atenção.
                  </p>
                </div>
              </article>
              <article className="overflow-hidden rounded-2xl border bg-background">
                <img
                  src={painelImg}
                  alt="Painel do estabelecimento aberto em um tablet sobre o balcão, com gráficos de vendas"
                  width={1200}
                  height={848}
                  loading="lazy"
                  className="h-56 w-full object-cover"
                />
                <div className="p-8">
                  <h3 className="text-xl font-semibold">Painel do estabelecimento</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Eventos, cardápios, produtos, pedidos, retiradas, funcionários e relatórios. Mais o scanner
                    de balcão que dá baixa no saldo.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-3xl font-semibold md:text-4xl">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="mt-8">
            {faq.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* CTA final */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold md:text-4xl">Teste no seu próximo evento.</h2>
              <p className="mt-2 max-w-xl text-sm opacity-80">
                Crie a conta do estabelecimento, cadastre o cardápio e gere o QR Code do seu primeiro estande em
                poucos minutos.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary" className="tap-target">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Cadastrar
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="tap-target bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/auth">Entrar</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-8 text-xs text-muted-foreground">
          <span>TapGo · MVP de validação</span>
          <span>Pagamentos simulados nesta versão</span>
        </div>
      </footer>
    </div>
  );
}
