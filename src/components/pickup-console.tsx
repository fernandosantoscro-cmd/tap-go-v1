import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Clock, Flame, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { extractOrderCode, QrScanner } from "@/components/qr-scanner";
import { playScanCue, ScanFeedbackOverlay, type ScanFeedback } from "@/components/scan-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { maskCpf, onlyDigits } from "@/lib/cpf";
import { formatBRL, ORDER_STATUS_LABEL } from "@/lib/format";
import type { VoucherItem, VoucherPayload } from "@/lib/tapgo-types";
import { kitchenItemLabel } from "@/lib/voucher-groups";

export interface PickupResult {
  voucher: VoucherPayload | null;
  error: string | null;
}

export interface PickupConsoleProps {
  /** Busca o voucher pelo código, já validando o vínculo com a conta/estabelecimento. */
  onLookup: (code: string) => Promise<PickupResult>;
  /** Registra a retirada das quantidades selecionadas. */
  onRegister: (code: string, items: { item_id: string; quantity: number }[]) => Promise<PickupResult>;
  /** Libera uma quantidade do item como pronta (valor absoluto). */
  onSetReadyQuantity?: (code: string, itemId: string, quantity: number) => Promise<{ error: string | null }>;
  /** Busca pedidos ativos pelo CPF, quando o cliente está sem o QR Code. */
  onFindByDocument?: (document: string) => Promise<{ orders: VoucherPayload[]; error: string | null }>;
  /** Abre um pedido vindo da fila, sem escanear. */
  openRequest?: { code: string; nonce: number } | null;
  /** Avisa o pai quando a retirada muda o pedido (para atualizar a fila). */
  onChanged?: () => void;
}

/** Console de leitura e retirada usado pelo dono (painel) e pelo funcionário (balcão). */
export function PickupConsole({
  onLookup,
  onRegister,
  onSetReadyQuantity,
  onFindByDocument,
  openRequest,
  onChanged,
}: PickupConsoleProps) {
  const [voucher, setVoucher] = useState<VoucherPayload | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [manualCode, setManualCode] = useState("");
  const [cpfInput, setCpfInput] = useState("");
  const [matches, setMatches] = useState<VoucherPayload[] | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [frame, setFrame] = useState<"idle" | "success" | "error">("idle");



  function applyVoucher(data: VoucherPayload) {
    setVoucher(data);
    setQuantities(
      Object.fromEntries(
        data.items.map((item) => [
          item.id,
          item.available_quantity > 0 ? item.available_quantity : 0,
        ]),
      ),
    );
  }

  function fail(message: string) {
    setFrame("error");
    playScanCue("error");
    toast.error(message);
    setTimeout(() => setFrame("idle"), 1200);
  }

  const loadMutation = useMutation({
    mutationFn: (code: string) => onLookup(code),
    onSuccess: (result) => {
      if (result.error || !result.voucher) {
        fail(result.error ?? "Voucher não encontrado");
        return;
      }
      applyVoucher(result.voucher);
      setFrame("success");
      playScanCue("success");
      setFeedback({
        kind: "success",
        title: "Voucher lido",
        detail: `${result.voucher.order.code} · ${formatBRL(result.voucher.order.total_cents)}`,
      });
      setTimeout(() => setFrame("idle"), 1400);
    },
    onError: (error: Error) => fail(error.message || "Falha ao consultar o voucher"),
  });

  const pickupMutation = useMutation({
    mutationFn: (payload: { code: string; items: { item_id: string; quantity: number }[] }) =>
      onRegister(payload.code, payload.items),
    onSuccess: (result, payload) => {
      if (result.error || !result.voucher) {
        fail(result.error ?? "Não foi possível registrar a retirada");
        return;
      }
      const total = payload.items.reduce((sum, entry) => sum + entry.quantity, 0);
      onChanged?.();
      setVoucher(result.voucher);
      setQuantities(Object.fromEntries(result.voucher.items.map((item) => [item.id, 0])));
      playScanCue("success");
      setFeedback({
        kind: "success",
        title: "Retirada registrada",
        detail: `${result.voucher.order.code} · ${total} ${total === 1 ? "item entregue" : "itens entregues"}`,
      });
    },
    onError: (error: Error) => fail(error.message || "Falha ao registrar a retirada"),
  });

  const readyMutation = useMutation({
    mutationFn: (payload: { code: string; itemId: string; quantity: number }) =>
      onSetReadyQuantity!(payload.code, payload.itemId, payload.quantity).then(async (res) => {
        if (res.error) throw new Error(res.error);
        return onLookup(payload.code);
      }),
    onSuccess: (result) => {
      if (result.voucher) applyVoucher(result.voucher);
      onChanged?.();
      toast.success("Quantidade liberada para retirada");
    },
    onError: (error: Error) => toast.error(error.message || "Falha ao liberar a quantidade"),
  });

  const findMutation = useMutation({
    mutationFn: (value: string) => onFindByDocument!(value),
    onSuccess: (result) => {
      if (result.error) {
        fail(result.error);
        return;
      }
      if (result.orders.length === 0) {
        toast.error("Nenhum pedido ativo para este CPF.");
        setMatches([]);
        return;
      }
      if (result.orders.length === 1) {
        applyVoucher(result.orders[0]!);
        setMatches(null);
        playScanCue("success");
        toast.success(`Pedido ${result.orders[0]!.order.code} encontrado`);
        return;
      }
      setMatches(result.orders);
    },
    onError: (error: Error) => fail(error.message || "Falha ao buscar pelo CPF"),
  });


  const handleDetected = useCallback(
    (raw: string) => {
      const code = extractOrderCode(raw);
      if (!code || loadMutation.isPending) return;
      loadMutation.mutate(code);
    },
    [loadMutation],
  );

  const lastOpenRef = useRef<number>(0);
  useEffect(() => {
    if (!openRequest || openRequest.nonce === lastOpenRef.current) return;
    lastOpenRef.current = openRequest.nonce;
    loadMutation.mutate(openRequest.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest]);

  const totalSelected = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
  const allDelivered = voucher?.items.every((item) => item.remaining_quantity === 0) ?? false;
  const paidAt = voucher?.order.paid_at ?? null;

  function renderRow(item: VoucherItem) {
    const done = item.remaining_quantity === 0;
    return (
      <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
        <span aria-hidden className="text-2xl">
          {item.emoji ?? (item.requires_prep ? "🍽️" : "🍸")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {item.quantity}× {item.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.available_quantity} pronta(s) · {item.preparing_quantity} em preparo · {item.delivered_quantity}{" "}
            retirada(s)
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
        {!done && item.preparing_quantity > 0 && (
          <>
            <Badge variant="outline" className="ml-1 shrink-0">
              {item.preparing_quantity} em preparo
            </Badge>
            {onSetReadyQuantity && voucher && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={readyMutation.isPending}
                  onClick={() =>
                    readyMutation.mutate({
                      code: voucher.order.code,
                      itemId: item.id,
                      quantity: item.ready_quantity + 1,
                    })
                  }
                >
                  Liberar +1
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={readyMutation.isPending}
                  onClick={() =>
                    readyMutation.mutate({ code: voucher.order.code, itemId: item.id, quantity: item.quantity })
                  }
                >
                  Liberar tudo
                </Button>
              </div>
            )}
          </>
        )}
      </li>
    );
  }


  const counterItems = (voucher?.items ?? []).filter((item) => !item.requires_prep);
  const kitchenItems = (voucher?.items ?? []).filter((item) => item.requires_prep);

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <ScanFeedbackOverlay feedback={feedback} onDone={() => setFeedback(null)} />

      <section className="rounded-2xl border bg-background p-5">
        <QrScanner onDetected={handleDetected} paused={Boolean(voucher)} frame={frame} />
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

        {onFindByDocument && (
          <div className="mt-4 rounded-xl border border-dashed p-4">
            <p className="text-sm font-medium">Cliente sem o QR Code?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Busque o pedido pelo CPF informado no pagamento.
            </p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const digits = onlyDigits(cpfInput);
                if (digits.length !== 11) {
                  toast.error("Digite os 11 números do CPF.");
                  return;
                }
                findMutation.mutate(digits);
              }}
            >
              <Input
                value={cpfInput}
                onChange={(event) => setCpfInput(maskCpf(event.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                aria-label="CPF do cliente"
              />
              <Button type="submit" variant="outline" disabled={findMutation.isPending}>
                {findMutation.isPending ? "Buscando…" : "Buscar pedido"}
              </Button>
            </form>
            {matches && matches.length > 1 && (
              <ul className="mt-3 space-y-2">
                {matches.map((entry) => (
                  <li key={entry.order.code}>
                    <Button
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={() => {
                        applyVoucher(entry);
                        setMatches(null);
                      }}
                    >
                      <span className="font-display tracking-[0.2em]">{entry.order.code}</span>
                      <span>{formatBRL(entry.order.total_cents)}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
                      Itens em preparo entram com quantidade zero — marque como pronto ou some manualmente.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 grid gap-2">
              <Button
                className="h-14 text-base"
                disabled={totalSelected === 0 || pickupMutation.isPending || voucher.order.payment_status !== "pago"}
                onClick={() =>
                  pickupMutation.mutate({
                    code: voucher.order.code,
                    items: Object.entries(quantities)
                      .filter(([, quantity]) => quantity > 0)
                      .map(([item_id, quantity]) => ({ item_id, quantity })),
                  })
                }
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
  );
}
