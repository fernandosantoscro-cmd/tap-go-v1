import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ScanLine, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/acessar")({
  head: () => ({
    meta: [
      { title: "Acessar plataforma — TapGo" },
      {
        name: "description",
        content:
          "Escolha como entrar no TapGo: dono do estabelecimento com login e senha, ou funcionário com código do bar e PIN individual.",
      },
      { property: "og:title", content: "Acessar plataforma — TapGo" },
      { property: "og:description", content: "Entrada para donos de estabelecimento e para a equipe do balcão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <p className="font-display text-xl font-semibold">
            Tap<span className="text-primary">Go</span>
          </p>
          <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Como você vai entrar?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha o seu perfil para ir direto ao lugar certo.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl border bg-background p-7">
            <ShieldCheck className="size-7 text-primary" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">Sou dono</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Painel administrativo: cardápios, QR Codes, pedidos, equipe e relatórios. Entre com e-mail e senha ou
              com o Google.
            </p>
            <Button asChild className="mt-6 h-12 w-full">
              <Link to="/auth">
                Entrar como dono
                <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="link" className="mt-2 w-full text-xs">
              <Link to="/auth" search={{ mode: "signup" }}>
                Ainda não tenho conta — cadastrar
              </Link>
            </Button>
          </section>

          <section className="rounded-3xl border bg-background p-7">
            <ScanLine className="size-7 text-primary" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">Sou funcionário</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Operação do balcão: fila de preparo, liberação por quantidade e leitura de vouchers. Use o código do
              estabelecimento e o seu PIN individual.
            </p>
            <Button asChild variant="secondary" className="mt-6 h-12 w-full">
              <Link to="/scanner">
                Entrar com código e PIN
                <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              O dono encontra o código e os PINs em Painel &gt; Equipe.
            </p>
          </section>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          É cliente e quer ver seus pedidos?{" "}
          <Link to="/meus-pedidos" className="underline">
            Abrir Meus pedidos
          </Link>
        </p>
      </div>
    </div>
  );
}
