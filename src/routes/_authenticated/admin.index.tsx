import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HelpCircle, QrCode, ReceiptText, Timer, Wallet } from "lucide-react";

import { OnboardingDialog } from "@/components/onboarding-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDateTime, ORDER_STATUS_LABEL } from "@/lib/format";
import { useEstablishment, useMenus, useOrders } from "@/lib/admin-db";


export const Route = createFileRoute("/_authenticated/admin/")({
  component: Overview,
});

function isToday(value: string) {
  return new Date(value).toDateString() === new Date().toDateString();
}

function Overview() {
  const establishment = useEstablishment();
  const orders = useOrders(establishment.data?.id);
  const menus = useMenus(establishment.data?.id);

  const all = orders.data ?? [];
  const today = all.filter((order) => isToday(order.created_at));
  const revenue = today
    .filter((order) => order.payment_status === "pago")
    .reduce((sum, order) => sum + order.total_cents, 0);
  const pendingPickup = all.filter(
    (order) => order.payment_status === "pago" && order.status !== "entregue" && order.status !== "cancelado",
  );

  const cards = [
    { label: "Pedidos hoje", value: String(today.length), icon: ReceiptText },
    { label: "Faturamento hoje", value: formatBRL(revenue), icon: Wallet },
    { label: "Aguardando retirada", value: String(pendingPickup.length), icon: Timer },
    { label: "Prontos no balcão", value: String(pendingPickup.filter((o) => o.status === "pronto").length), icon: Timer },
  ];

  return (
    <div className="space-y-8">
      <OnboardingDialog />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Visão geral</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {establishment.data?.name} · acompanhe a operação do evento em tempo real.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            localStorage.removeItem("tapgo.onboarding.done");
            window.location.reload();
          }}
        >
          <HelpCircle className="mr-2 size-4" /> Rever tutorial
        </Button>
      </header>


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border bg-background p-5">
            <card.icon className="size-5 text-primary" aria-hidden />
            <p className="mt-4 text-2xl font-semibold">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {(menus.data?.length ?? 0) === 0 && (
        <div className="rounded-2xl border border-dashed p-8">
          <QrCode className="size-6 text-primary" aria-hidden />
          <h2 className="mt-4 text-xl font-semibold">Comece criando seu primeiro cardápio</h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            Cadastre um evento, monte o cardápio com produtos e gere o QR Code que o cliente escaneia no celular.
          </p>
          <Button asChild className="mt-5">
            <Link to="/admin/cardapios">
              Criar cardápio <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Últimos pedidos</h2>
          <Button asChild variant="link" className="px-0">
            <Link to="/admin/pedidos">Ver todos</Link>
          </Button>
        </div>
        <div className="mt-4 divide-y rounded-2xl border bg-background">
          {all.slice(0, 8).map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-display font-semibold tracking-[0.15em]">{order.code}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(order.created_at)} · {order.order_items.length} item(ns)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{formatBRL(order.total_cents)}</span>
                <Badge variant={order.payment_status === "pago" ? "default" : "secondary"}>
                  {order.payment_status === "pago" ? ORDER_STATUS_LABEL[order.status] : "Aguardando pagamento"}
                </Badge>
              </div>
            </div>
          ))}
          {all.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
