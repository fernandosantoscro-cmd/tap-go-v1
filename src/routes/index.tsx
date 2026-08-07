import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, QrCode as QrCodeIcon, ScanLine, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TapGo — Acabe com a fila de pagamento no seu evento" },
      {
        name: "description",
        content:
          "O cliente escaneia o QR Code, pede e paga pelo celular e retira os produtos com um único voucher. Sem app, sem cadastro, sem fila.",
      },
      { property: "og:title", content: "TapGo — Acabe com a fila de pagamento no seu evento" },
      {
        property: "og:description",
        content: "Pedido e pagamento pelo celular, retirada com um único QR Code e saldo atualizado a cada entrega.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: QrCodeIcon, title: "Escaneia", text: "O cliente aponta a câmera para o QR Code do balcão. Sem app, sem cadastro." },
  { icon: Timer, title: "Paga", text: "Escolhe os produtos e paga em segundos, andando pelo evento." },
  { icon: ScanLine, title: "Retira", text: "Mostra um único QR Code no balcão. O saldo cai a cada retirada." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold tracking-tight">
          Tap<span className="text-primary">Go</span>
        </span>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/scanner">Balcão</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-28">
          <p className="mb-6 inline-flex items-center rounded-full border px-3 py-1 text-xs tracking-wide text-muted-foreground">
            MVP para eventos piloto
          </p>
          <h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold md:text-7xl">
            A fila de pagamento <span className="text-primary">acabou</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Bares, festivais, arenas e beach clubs. O cliente pede e paga pelo celular e retira os produtos
            apresentando um único QR Code — com saldo atualizado a cada retirada.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" className="tap-target">
              <Link to="/auth">
                Criar conta do estabelecimento
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="tap-target">
              <Link to="/menu/$code" params={{ code: "bar01" }}>
                Ver cardápio de demonstração
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-secondary/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title}>
                <step.icon className="size-6 text-primary" aria-hidden />
                <h2 className="mt-5 text-xl font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-semibold md:text-4xl">Dois produtos, uma operação.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <article className="rounded-2xl border p-8">
              <h3 className="text-xl font-semibold">PWA do cliente</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Cardápio, carrinho, pagamento e voucher digital. Feito para quem está em pé, com pouco tempo e
                pouca atenção.
              </p>
              <Button asChild variant="link" className="mt-4 px-0">
                <Link to="/menu/$code" params={{ code: "bar01" }}>
                  Abrir demonstração
                </Link>
              </Button>
            </article>
            <article className="rounded-2xl border p-8">
              <h3 className="text-xl font-semibold">Painel do estabelecimento</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Eventos, cardápios, produtos, pedidos, retiradas, funcionários e relatórios. Mais o scanner de
                balcão que dá baixa no saldo.
              </p>
              <Button asChild variant="link" className="mt-4 px-0">
                <Link to="/scanner">Abrir scanner do balcão</Link>
              </Button>
            </article>
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
