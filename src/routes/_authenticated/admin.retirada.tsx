import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Flame, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { extractOrderCode, QrScanner } from "@/components/qr-scanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useEstablishment } from "@/lib/admin-db";
import { formatBRL, ORDER_STATUS_LABEL } from "@/lib/format";
import { ownerFetchVoucher, ownerRegisterPickup } from "@/lib/owner-pickup.functions";
import type { VoucherItem, VoucherPayload } from "@/lib/tapgo-types";
import { isReadyForPickup, kitchenItemLabel } from "@/lib/voucher-groups";

export const Route = createFileRoute("/_authenticated/admin/retirada")({
  component: PickupPage,
});

function PickupPage() {
  const establishment = useEstablishment();
  const lookup = useServerFn(ownerFetchVoucher);
  const pickup = useServerFn(ownerRegisterPickup);

  const [voucher, setVoucher] = useState<VoucherPayload | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [manualCode, setManualCode] = useState("");

  function applyVoucher(data: VoucherPayload) {
    setVoucher(data);
    setQuantities(
      Object.fromEntries(
        data.items.map((item) => [
          item.id,
          isReadyForPickup(item) && item.available_quantity > 0 ? item.available_quantity : 0,
        ]),
      ),
    );
  }

  const loadMutation = useMutation({
    mutationFn: (code: string) => lookup({ data: { code } }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (!result.voucher) {
        toast.error("Voucher não encontrado");
        return;
      }
      applyVoucher(result.voucher);
    },
    onError: (error: Error) => toast.error(error.message || "Falha ao consultar o voucher"),
  });

  const pickupMutation = useMutation({
    mutationFn: () =>
      pickup({
        data: {
          code: voucher!.order.code,
          items: Object.entries(quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([item_id, quantity]) => ({ item_id, quantity })),
        },
      }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (!result.voucher) return;
      setVoucher(result.voucher);
      setQuantities(Object.fromEntries(result.voucher.items.map((item) => [item.id, 0])));
      toast.success("Retirada registrada");
    },
    onError: (error: Error) => toast.error(error.message || "Falha ao registrar a retirada"),
  });

  const handleDetected = useCallback(
    (raw: string) => {
      const code = extractOrderCode(raw);
      if (!code || loadMutation.isPending) return;
      loadMutation.mutate(code);
    },
    [loadMutation],
  );

  const totalSelected = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
  const allDelivered = voucher?.items.every((item) => item.available_quantity === 0) ?? false;
  const paidAt = voucher?.order.paid_at ?? null;

  function renderRow(item: VoucherItem) {
    const done = item.available_quantity === 0;
    const ready = isReadyForPickup(item);
    return (
      <li key={item.id} className="flex items-center gap-3 rounded-xl border p-3">
        <span aria-hidden className="text-2xl">
          {item.emoji ?? (item.requires_prep ? "🍽️" : "🍸")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {item.available_quantity} de {item.quantity} disponível
            {item.requires_prep ? ` · ${kitchenItemLabel(item, paidAt)}` : ""}
          </p>
        </div>
        {done ? (
          <CheckCircle2 className="size-5 text-success" aria-label="Item retirado" />
        ) : (
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              aria-label={`Menos um ${item.name}`}
              disabled={(quantities[item.id] ?? 0) <= 0}
              onClick={() =>
                setQuantities((current) => ({ ...current, [item.id]: Math.max(0, (current[item.id] ?? 0) - 1) }))
              }
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-8 text-center font-semibold">{quantities[item.id] ?? 0}</span>
            <Button
              size="icon"
              aria-label={`Mais um ${item.name}`}
              disabled={(quantities[item.id] ?? 0) >= item.available_quantity}
              onClick={() =>
                setQuantities((current) => ({
                  ...current,
                  [item.id]: Math.min(item.available_quantity, (current[item.id] ?? 0) + 1),
                }))
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>
        )}
        {!done && !ready && (
          <Badge variant="outline" className="ml-1 shrink-0">
            Em preparo
          </Badge>
        )}
      </li>
    );
  }

  const counterItems = (voucher?.items ?? []).filter((item) => !item.requires_prep);
  const kitchenItems = (voucher?.items ?? []).filter((item) => item.requires_prep);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Retirada</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leia o QR Code do voucher pela câmera deste dispositivo. Sem PIN: usa a conta de{" "}
          <strong>{establishment.data?.name ?? "seu estabelecimento"}</strong>.
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="rounded-2xl border bg-background p-5">
          <QrScanner onDetected={handleDetected} paused={Boolean(voucher)} />
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (manualCode.trim()) loadMutation.mutate(extractOrderCode(manualCode));
            }}
          >
            <Input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Digitar código do pedido"
              aria-label="Código do pedido"
            />
            <Button type="submit" variant="outline" disabled={loadMutation.isPending}>
              Buscar
            </Button>
          </form>
        </section>

        <section>
          {!voucher ? (
            <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {loadMutation.isPending ? "Consultando voucher…" : "Nenhum voucher lido ainda."}
            </div>
          ) : (
            <div className="rounded-2xl border bg-background p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl font-semibold tracking-[0.2em]">{voucher.order.code}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {voucher.menu?.name ?? "Cardápio"} · {formatBRL(voucher.order.total_cents)}
                  </p>
                </div>
                <Badge variant={voucher.order.payment_status === "pago" ? "default" : "destructive"}>
                  {voucher.order.payment_status === "pago"
                    ? ORDER_STATUS_LABEL[voucher.order.status]
                    : "Pagamento pendente"}
                </Badge>
              </div>

              <Separator className="my-5" />

              {voucher.order.payment_status !== "pago" ? (
                <p className="text-sm text-destructive">Este pedido ainda não foi pago. Não libere os produtos.</p>
              ) : allDelivered ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="size-5" aria-hidden /> Todos os itens já foram retirados.
                </p>
              ) : (
                <div className="space-y-5">
                  {counterItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Balcão · entrega imediata
                      </p>
                      <ul className="mt-3 space-y-3">{counterItems.map(renderRow)}</ul>
                    </div>
                  )}
                  {kitchenItems.length > 0 && (
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        <Flame className="size-3.5" aria-hidden /> Cozinha · com preparo
                      </p>
                      <ul className="mt-3 space-y-3">{kitchenItems.map(renderRow)}</ul>
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" aria-hidden />
                        Itens em preparo entram com quantidade zero — some manualmente se quiser entregar antes.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 grid gap-2">
                <Button
                  className="h-14 text-base"
                  disabled={
                    totalSelected === 0 || pickupMutation.isPending || voucher.order.payment_status !== "pago"
                  }
                  onClick={() => pickupMutation.mutate()}
                >
                  {pickupMutation.isPending
                    ? "Registrando…"
                    : `Confirmar retirada de ${totalSelected} ${totalSelected === 1 ? "item" : "itens"}`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setVoucher(null);
                    setQuantities({});
                    setManualCode("");
                  }}
                >
                  <RotateCcw className="mr-2 size-4" />
                  Ler outro voucher
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
