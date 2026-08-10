import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, Clock, Flame, RefreshCw, ScanLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatTime, ORDER_STATUS_LABEL } from "@/lib/format";
import type { OpenOrder, VoucherItem } from "@/lib/tapgo-types";
import { isReadyForPickup, kitchenItemLabel } from "@/lib/voucher-groups";

type Filter = "preparo" | "prontos" | "todos";

export interface OrderQueueProps {
  /** Lista os pedidos pagos com itens pendentes. */
  onList: () => Promise<OpenOrder[]>;
  /** Altera o status de um item do pedido (preparando/pronto). */
  onSetItemStatus: (code: string, itemId: string, status: "preparando" | "pronto") => Promise<{ error: string | null }>;
  /** Abre o pedido no console de retirada, sem escanear. */
  onOpenOrder?: (code: string) => void;
  /** Identifica a fila no cache (dono ou PIN do estande). */
  scope: string;
}

function pendingItems(order: OpenOrder): VoucherItem[] {
  return order.items.filter((item) => item.available_quantity > 0);
}

/** Fila de preparo: o atendente vê a lista de compras e libera cada produto antes de escanear. */
export function OrderQueue({ onList, onSetItemStatus, onOpenOrder, scope }: OrderQueueProps) {
  const queryClient = useQueryClient();
  const queryKey = ["order-queue", scope];
  const [filter, setFilter] = useState<Filter>("todos");

  const queue = useQuery({
    queryKey,
    queryFn: () => onList(),
    refetchInterval: 5000,
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { code: string; itemId: string; status: "preparando" | "pronto" }) => {
      const result = await onSetItemStatus(payload.code, payload.itemId, payload.status);
      if (result.error) throw new Error(result.error);
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.status === "pronto" ? "Item liberado para retirada" : "Item em preparo");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível atualizar o item"),
  });

  const allOrders = queue.data ?? [];
  const orders = allOrders
    .map((order) => ({ order, items: pendingItems(order) }))
    .filter(({ items }) => items.length > 0)
    .filter(({ items }) => {
      if (filter === "prontos") return items.some((item) => isReadyForPickup(item));
      if (filter === "preparo") return items.some((item) => !isReadyForPickup(item));
      return true;
    });

  const readyCount = allOrders.filter((order) => pendingItems(order).some((item) => isReadyForPickup(item))).length;
  const prepCount = allOrders.filter((order) => pendingItems(order).some((item) => !isReadyForPickup(item))).length;

  const tabs: { key: Filter; label: string }[] = [
    { key: "preparo", label: `Em preparo (${prepCount})` },
    { key: "prontos", label: `Prontos (${readyCount})` },
    { key: "todos", label: `Todos (${allOrders.length})` },
  ];

  return (
    <section className="rounded-2xl border bg-background p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ChefHat className="size-5 text-primary" aria-hidden />
            Fila de preparo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marque cada produto como pronto. O cliente vê a mudança no celular na hora.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void queue.refetch()}
          disabled={queue.isFetching}
          aria-label="Atualizar fila"
        >
          <RefreshCw className={`mr-2 size-4 ${queue.isFetching ? "animate-spin" : ""}`} aria-hidden />
          Atualizar
        </Button>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={filter === tab.key ? "default" : "outline"}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {queue.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando pedidos…</p>
      ) : queue.isError ? (
        <p className="mt-6 text-sm text-destructive">
          {(queue.error as Error)?.message || "Não foi possível carregar a fila."}
        </p>
      ) : orders.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum pedido pendente por aqui. Assim que um pagamento entrar, ele aparece nesta fila.
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {orders.map(({ order, items }) => {
            const allReady = items.every((item) => isReadyForPickup(item));
            return (
              <li key={order.code} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold tracking-[0.18em]">{order.code}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[order.event_name, order.menu_name].filter(Boolean).join(" · ") || "Cardápio"} ·{" "}
                      {formatTime(order.paid_at ?? order.created_at)} · {formatBRL(order.total_cents)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={allReady ? "default" : "outline"}>
                      {allReady ? "Pronto para retirada" : ORDER_STATUS_LABEL[order.status]}
                    </Badge>
                    {onOpenOrder && (
                      <Button size="sm" variant="outline" onClick={() => onOpenOrder(order.code)}>
                        <ScanLine className="mr-2 size-4" aria-hidden />
                        Abrir retirada
                      </Button>
                    )}
                  </div>
                </div>

                <ul className="mt-3 space-y-2">
                  {items.map((item) => {
                    const ready = isReadyForPickup(item);
                    const busy =
                      statusMutation.isPending && statusMutation.variables?.itemId === item.id;
                    return (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2"
                      >
                        <span aria-hidden className="text-xl">
                          {item.emoji ?? (item.requires_prep ? "🍽️" : "🍸")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.available_quantity}× {item.name}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            {item.requires_prep ? (
                              <>
                                <Flame className="size-3" aria-hidden />
                                {kitchenItemLabel(item, order.paid_at)}
                              </>
                            ) : (
                              <>
                                <Clock className="size-3" aria-hidden />
                                Balcão · entrega imediata
                              </>
                            )}
                          </p>
                        </div>
                        {ready ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-success">
                            <CheckCircle2 className="size-4" aria-hidden />
                            Liberado
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            {item.status !== "preparando" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  statusMutation.mutate({
                                    code: order.code,
                                    itemId: item.id,
                                    status: "preparando",
                                  })
                                }
                              >
                                Iniciar preparo
                              </Button>
                            )}
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                statusMutation.mutate({ code: order.code, itemId: item.id, status: "pronto" })
                              }
                            >
                              {busy ? "Salvando…" : "Pronto"}
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {items.some((item) => !isReadyForPickup(item)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    disabled={statusMutation.isPending}
                    onClick={() => {
                      for (const item of items.filter((entry) => !isReadyForPickup(entry))) {
                        statusMutation.mutate({ code: order.code, itemId: item.id, status: "pronto" });
                      }
                    }}
                  >
                    Marcar tudo pronto
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
