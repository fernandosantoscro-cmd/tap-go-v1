import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, LogOut, Minus, Plus, RotateCcw, ScanLine } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { extractOrderCode, QrScanner } from "@/components/qr-scanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatBRL, ORDER_STATUS_LABEL, STAFF_ROLE_LABEL } from "@/lib/format";
import { registerPickup, staffGetOrder, staffLogin } from "@/lib/tapgo.functions";
import type { StaffSession, VoucherPayload } from "@/lib/tapgo-types";

const PIN_KEY = "tapgo.staff.pin";
const SESSION_KEY = "tapgo.staff.session";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Scanner do balcão — TapGo" },
      {
        name: "description",
        content: "Leia o QR Code do voucher pela câmera e registre retiradas parciais com baixa automática de saldo.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Scanner do balcão — TapGo" },
      { property: "og:description", content: "Leitura de vouchers e registro de retiradas no balcão." },
    ],
  }),
  component: ScannerPage,
});

function ScannerPage() {
  const login = useServerFn(staffLogin);
  const lookup = useServerFn(staffGetOrder);
  const pickup = useServerFn(registerPickup);

  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [session, setSession] = useState<StaffSession | null>(null);
  const [voucher, setVoucher] = useState<VoucherPayload | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    const savedPin = localStorage.getItem(PIN_KEY);
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedPin && savedSession) {
      setPin(savedPin);
      setSession(JSON.parse(savedSession) as StaffSession);
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: (value: string) => login({ data: { pin: value } }),
    onSuccess: (data, value) => {
      if (!data) {
        toast.error("PIN inválido");
        return;
      }
      localStorage.setItem(PIN_KEY, value);
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      setPin(value);
      setSession(data);
      toast.success(`Olá, ${data.name}`);
    },
    onError: () => toast.error("Não foi possível validar o PIN"),
  });

  const loadMutation = useMutation({
    mutationFn: (code: string) => lookup({ data: { pin, code } }),
    onSuccess: (data) => {
      if (!data) {
        toast.error("Voucher não encontrado neste estabelecimento");
        return;
      }
      setVoucher(data);
      setQuantities(
        Object.fromEntries(data.items.map((item) => [item.id, item.available_quantity > 0 ? item.available_quantity : 0])),
      );
    },
    onError: () => toast.error("Falha ao consultar o voucher"),
  });

  const pickupMutation = useMutation({
    mutationFn: () =>
      pickup({
        data: {
          pin,
          code: voucher!.order.code,
          items: Object.entries(quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([item_id, quantity]) => ({ item_id, quantity })),
        },
      }),
    onSuccess: (data) => {
      if (!data) {
        toast.error("Não foi possível registrar a retirada");
        return;
      }
      setVoucher(data);
      setQuantities(Object.fromEntries(data.items.map((item) => [item.id, 0])));
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

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-6">
        <form
          className="w-full max-w-sm rounded-3xl border bg-background p-8"
          onSubmit={(event) => {
            event.preventDefault();
            loginMutation.mutate(pinInput);
          }}
        >
          <ScanLine className="size-7 text-primary" aria-hidden />
          <h1 className="mt-5 text-2xl font-semibold">Scanner do balcão</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe o PIN de funcionário para liberar a leitura de vouchers.
          </p>
          <div className="mt-6">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              className="mt-1 text-center text-2xl tracking-[0.4em]"
              required
            />
          </div>
          <Button type="submit" className="mt-5 h-12 w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Validando…" : "Entrar"}
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">Demonstração: PIN 1234</p>
        </form>
      </div>
    );
  }

  const totalSelected = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
  const allDelivered =
    voucher && voucher.items.every((item) => item.available_quantity === 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="font-display text-lg font-semibold">
              Tap<span className="text-primary">Go</span> · Balcão
            </p>
            <p className="text-xs text-muted-foreground">
              {session.name} · {STAFF_ROLE_LABEL[session.role] ?? session.role} · {session.establishment}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem(PIN_KEY);
              localStorage.removeItem(SESSION_KEY);
              setSession(null);
              setVoucher(null);
              setPin("");
            }}
          >
            <LogOut className="mr-2 size-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-2">
        <section>
          <h1 className="text-xl font-semibold">Leitor de voucher</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A câmera fica pausada enquanto um pedido está aberto.
          </p>
          <div className="mt-4">
            <QrScanner onDetected={handleDetected} paused={Boolean(voucher)} />
          </div>

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
            <div className="rounded-2xl border p-6">
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
                <p className="text-sm text-destructive">
                  Este pedido ainda não foi pago. Não libere os produtos.
                </p>
              ) : allDelivered ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="size-5" aria-hidden /> Todos os itens já foram retirados.
                </p>
              ) : (
                <ul className="space-y-3">
                  {voucher.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-xl border p-3">
                      <span aria-hidden className="text-2xl">
                        {item.emoji ?? "🍸"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.available_quantity} de {item.quantity} disponível
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`Menos um ${item.name}`}
                          disabled={(quantities[item.id] ?? 0) <= 0}
                          onClick={() =>
                            setQuantities((current) => ({
                              ...current,
                              [item.id]: Math.max(0, (current[item.id] ?? 0) - 1),
                            }))
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
                    </li>
                  ))}
                </ul>
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
      </main>
    </div>
  );
}
