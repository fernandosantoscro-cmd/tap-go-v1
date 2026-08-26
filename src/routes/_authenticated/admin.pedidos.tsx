import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ChefHat, Download, PackageCheck, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DateRangeFilter } from "@/components/date-range-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishment, useOrders, useSetOrderStatus, type AdminOrder } from "@/lib/admin-db";
import { buildRange, downloadCsv, toCsv, type DateRange } from "@/lib/date-range";
import { formatBRL, formatDateTime, ORDER_STATUS_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  component: OrdersPage,
});

const FILTERS = [
  { key: "abertos", label: "Em aberto" },
  { key: "pronto", label: "Prontos" },
  { key: "entregue", label: "Entregues" },
  { key: "todos", label: "Todos" },
] as const;

function OrdersPage() {
  const establishment = useEstablishment();
  const [range, setRange] = useState<DateRange>(() => buildRange("hoje"));
  const [custom, setCustom] = useState({ from: "", to: "" });
  const orders = useOrders(establishment.data?.id, range);
  const setStatus = useSetOrderStatus();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("abertos");


  useEffect(() => {
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const list = (orders.data ?? []).filter((order) => {
    if (filter === "todos") return true;
    if (filter === "pronto") return order.status === "pronto";
    if (filter === "entregue") return order.status === "entregue";
    return order.payment_status === "pago" && order.status !== "entregue" && order.status !== "cancelado";
  });

  function changeStatus(order: AdminOrder, status: string) {
    setStatus.mutate(
      { orderId: order.id, status },
      {
        onSuccess: () => toast.success(`Pedido ${order.code}: ${ORDER_STATUS_LABEL[status]}`),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  function markItemReady(order: AdminOrder, itemId: string, name: string) {
    setStatus.mutate(
      { orderId: order.id, status: "pronto", itemId },
      {
        onSuccess: () => toast.success(`${name} pronto para retirada`),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }


  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Código", "Data", "Cliente", "Pagamento", "Status pagamento", "Status", "Total (R$)", "Itens"],
      ...list.map((order) => [
        order.code,
        formatDateTime(order.created_at),
        order.customer_name ?? "",
        order.payment_method === "card" ? "Cartão" : "PIX",
        order.payment_status,
        ORDER_STATUS_LABEL[order.status] ?? order.status,
        (order.total_cents / 100).toFixed(2).replace(".", ","),
        order.order_items.map((item) => `${item.quantity}x ${item.product_name}`).join(" | "),
      ]),
    ];
    downloadCsv(`tapgo-pedidos-${range.key}.csv`, toCsv(rows));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualiza em tempo real. Marque como <strong>Pronto</strong> para liberar a retirada no balcão.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={list.length === 0}>
            <Download className="mr-2 size-4" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => void orders.refetch()}>
            <RefreshCcw className="mr-2 size-4" /> Atualizar
          </Button>
        </div>
      </header>

      <DateRangeFilter value={range} onChange={setRange} custom={custom} onCustomChange={setCustom} />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={filter === item.key ? "default" : "outline"}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {list.map((order) => {
          const delivered = order.order_items.reduce((sum, item) => sum + item.delivered_quantity, 0);
          const total = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

          return (
            <article key={order.id} className="rounded-2xl border bg-background p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold tracking-[0.18em]">{order.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(order.created_at)} · {order.customer_name ?? "Cliente"} ·{" "}
                    {order.payment_method === "card" ? "Cartão" : "PIX"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatBRL(order.total_cents)}</p>
                  <Badge variant={order.payment_status === "pago" ? "default" : "secondary"} className="mt-1">
                    {order.payment_status === "pago" ? ORDER_STATUS_LABEL[order.status] : "Aguardando pagamento"}
                  </Badge>
                  {(() => {
                    const fiscal = (order as unknown as Record<string, unknown>)["fiscal_status"];
                    if (!fiscal || fiscal === "nenhuma") return null;
                    return (
                      <Badge
                        variant={fiscal === "emitida" ? "outline" : fiscal === "erro" ? "destructive" : "secondary"}
                        className="mt-1 ml-1"
                      >
                        {fiscal === "emitida" ? "NF emitida" : fiscal === "erro" ? "NF com erro" : "NF pendente"}
                      </Badge>
                    );
                  })()}
                </div>
              </div>

              <ul className="mt-4 space-y-1 text-sm">
                {order.order_items.map((item) => {
                  const ready = item.status === "pronto" || item.status === "entregue";
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <span>
                        {item.emoji ?? (item.requires_prep ? "🍽️" : "🍸")} {item.quantity}× {item.product_name}
                        {item.requires_prep ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            cozinha · {item.prep_minutes} min
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {item.delivered_quantity}/{item.quantity} retirado
                        </span>
                        {item.requires_prep && order.payment_status === "pago" && item.delivered_quantity < item.quantity ? (
                          ready ? (
                            <Badge variant="default">Pronto</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7"
                              onClick={() => markItemReady(order, item.id, item.product_name)}
                            >
                              Marcar pronto
                            </Button>
                          )
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>


              <p className="mt-3 text-xs text-muted-foreground">
                Retirada: {delivered} de {total} itens
              </p>

              {order.payment_status === "pago" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => changeStatus(order, "preparando")}>
                    <ChefHat className="mr-2 size-4" /> Preparando
                  </Button>
                  <Button size="sm" onClick={() => changeStatus(order, "pronto")}>
                    <PackageCheck className="mr-2 size-4" /> Pronto
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => changeStatus(order, "entregue")}>
                    <CheckCircle2 className="mr-2 size-4" /> Entregue
                  </Button>
                  {(order as unknown as Record<string, unknown>)["fiscal_status"] === "erro" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reissue.isPending}
                      onClick={() =>
                        reissue.mutate(order.code, {
                          onSuccess: (r) =>
                            r.issued ? toast.success("Nota fiscal emitida") : toast.error(r.error ?? "Falha ao emitir"),
                          onError: (e: Error) => toast.error(e.message),
                        })
                      }
                    >
                      <FileText className="mr-2 size-4" /> Reemitir nota
                    </Button>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {list.length === 0 && (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum pedido neste filtro.
          </p>
        )}
      </div>
    </div>
  );
}
