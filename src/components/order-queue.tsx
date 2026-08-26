import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChefHat, Clock, Flame, RefreshCw, ScanLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatTime, ORDER_STATUS_LABEL } from "@/lib/format";
import type { OpenOrder, VoucherItem } from "@/lib/tapgo-types";
import { isPreparing, kitchenItemLabel } from "@/lib/voucher-groups";

type Filter = "preparo" | "prontos" | "todos";

export interface OrderQueueProps {
  /** Lista os pedidos pagos com itens pendentes. */
  onList: () => Promise<OpenOrder[]>;
  /** Define quantas unidades do item já estão prontas (valor absoluto). */
  onSetReadyQuantity: (code: string, itemId: string, quantity: number) => Promise<{ error: string | null }>;
  /** Aceita o pedido de preparo do cliente (item entra em preparo). */
  onAcceptPrep?: (code: string, itemId: string) => Promise<{ error: string | null }>;
  /** Abre o pedido no console de retirada, sem escanear. */
  onOpenOrder?: (code: string) => void;
  /** Identifica a fila no cache (dono ou PIN do estande). */
  scope: string;
}


function pendingItems(order: OpenOrder): VoucherItem[] {
  return order.items.filter((item) => item.remaining_quantity > 0);
}

/** Fila de preparo: o atendente libera as unidades aos poucos, sem precisar escanear. */
export function OrderQueue({ onList, onSetReadyQuantity, onAcceptPrep, onOpenOrder, scope }: OrderQueueProps) {
  const queryClient = useQueryClient();
  const queryKey = ["order-queue", scope];
  const [filter, setFilter] = useState<Filter>("todos");

  const queue = useQuery({
    queryKey,
    queryFn: () => onList(),
    refetchInterval: 5000,
  });

  const readyMutation = useMutation({
    mutationFn: async (payload: { code: string; itemId: string; quantity: number; label: string }) => {
      const result = await onSetReadyQuantity(payload.code, payload.itemId, payload.quantity);
      if (result.error) throw new Error(result.error);
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(payload.label);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível atualizar o item"),
  });

  const acceptMutation = useMutation({
    mutationFn: async (payload: { code: string; itemId: string; name: string }) => {
      if (!onAcceptPrep) throw new Error("Ação indisponível");
      const result = await onAcceptPrep(payload.code, payload.itemId);
      if (result.error) throw new Error(result.error);
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(`${payload.name}: preparo aceito`);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível aceitar o preparo"),
  });


  const allOrders = queue.data ?? [];
  const orders = allOrders
    .map((order) => ({ order, items: pendingItems(order) }))
    .filter(({ items }) => items.length > 0)
    .filter(({ items }) => {
      if (filter === "prontos") return items.some((item) => item.available_quantity > 0);
      if (filter === "preparo") return items.some((item) => isPreparing(item));
      return true;
    });

  const readyCount = allOrders.filter((order) => pendingItems(order).some((item) => item.available_quantity > 0)).length;
  const prepCount = allOrders.filter((order) => pendingItems(order).some((item) => isPreparing(item))).length;

  const tabs: { key: Filter; label: string }[] = [
    { key: "preparo", label: `Em preparo (${prepCount})` },
    { key: "prontos", label: `Prontos (${readyCount})` },
    { key: "todos", label: `Todos (${allOrders.length})` },
  ];

  const release = (order: OpenOrder, item: VoucherItem, add: number) => {
    const quantity = Math.min(item.quantity, item.ready_quantity + add);
    readyMutation.mutate({
      code: order.code,
      itemId: item.id,
      quantity,
      label:
        quantity >= item.quantity
          ? `${item.name}: tudo liberado para retirada`
          : `${item.name}: ${quantity} de ${item.quantity} prontas`,
    });
  };

  return (
    <section className="rounded-2xl border bg-background p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ChefHat className="size-5 text-primary" aria-hidden />
            Fila de preparo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Libere as unidades aos poucos (+1, +5 ou tudo). O cliente vê a quantidade pronta no celular na hora.
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
            const allReady = items.every((item) => item.preparing_quantity === 0);
            return (
              <li key={order.code} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold tracking-[0.18em]">{order.code}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[order.customer_name, order.event_name, order.menu_name].filter(Boolean).join(" · ") ||
                        "Cardápio"}{" "}
                      · {formatTime(order.paid_at ?? order.created_at)} · {formatBRL(order.total_cents)}
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
                    const busy = readyMutation.isPending && readyMutation.variables?.itemId === item.id;
                    const pending = item.preparing_quantity;
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
                            {item.quantity}× {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.available_quantity} pronta(s) · {pending} em preparo · {item.delivered_quantity}{" "}
                            retirada(s)
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
                        {pending === 0 ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-success">
                            <CheckCircle2 className="size-4" aria-hidden />
                            Tudo liberado
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => release(order, item, 1)}>
                              +1
                            </Button>
                            {pending > 1 && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => release(order, item, Math.min(5, pending))}
                              >
                                +{Math.min(5, pending)}
                              </Button>
                            )}
                            <Button size="sm" disabled={busy} onClick={() => release(order, item, pending)}>
                              {busy ? "Salvando…" : "Tudo pronto"}
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {items.some((item) => isPreparing(item)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    disabled={readyMutation.isPending}
                    onClick={() => {
                      for (const item of items.filter((entry) => isPreparing(entry))) {
                        release(order, item, item.preparing_quantity);
                      }
                    }}
                  >
                    Liberar todo o pedido
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
