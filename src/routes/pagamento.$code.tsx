import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/format";
import { createPixCharge, getPaymentConfig } from "@/lib/integrations.functions";
import { confirmPayment, fetchVoucher } from "@/lib/tapgo.functions";
import type { VoucherPayload } from "@/lib/tapgo-types";

export const Route = createFileRoute("/pagamento/$code")({
  loader: async ({ params }) => {
    const voucher = await fetchVoucher({ data: { code: params.code } });
    if (!voucher) throw notFound();
    return voucher;
  },
  head: () => ({
    meta: [
      { title: "Pagamento do pedido — TapGo" },
      { name: "description", content: "Finalize o pagamento do seu pedido e receba o voucher digital de retirada." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Pagamento do pedido — TapGo" },
      { property: "og:description", content: "Finalize o pagamento e receba seu QR Code de retirada." },
    ],
  }),
  errorComponent: () => <PaymentUnavailable />,
  notFoundComponent: () => <PaymentUnavailable />,
  component: PaymentPage,
});

function PaymentUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Pedido não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Volte ao cardápio e faça o pedido novamente.</p>
      </div>
    </div>
  );
}

/** Chave PIX simulada, no formato de um payload EMV de verdade. */
function pixPayload(code: string, totalCents: number) {
  const amount = (totalCents / 100).toFixed(2);
  return `00020126580014BR.GOV.BCB.PIX0136tapgo-${code.toLowerCase()}5204000053039865802BR5905TAPGO6009SAO PAULO540${amount.length}${amount}6304DEMO`;
}

function PaymentPage() {
  const initial = Route.useLoaderData() as VoucherPayload;
  const navigate = useNavigate();
  const pay = useServerFn(confirmPayment);
  const getConfig = useServerFn(getPaymentConfig);
  const pixCharge = useServerFn(createPixCharge);
  const [copied, setCopied] = useState(false);
  const [seconds, setSeconds] = useState(600);

  const isCard = initial.order.payment_method === "card";
  const payload = pixPayload(initial.order.code, initial.order.total_cents);

  // O estabelecimento tem cobrança real (Mercado Pago) configurada?
  const config = useQuery({
    queryKey: ["payment-config", initial.order.code],
    queryFn: () => getConfig({ data: { code: initial.order.code } }),
    staleTime: 300_000,
  });
  const realPix = Boolean(config.data?.realPix) && !isCard;

  // Acompanha o status do pedido (o webhook do Mercado Pago confirma o pagamento).
  const statusPoll = useQuery({
    queryKey: ["payment-status", initial.order.code],
    queryFn: () => fetchVoucher({ data: { code: initial.order.code } }),
    enabled: realPix,
    refetchInterval: 3_000,
  });

  const pixMutation = useMutation({
    mutationFn: () => pixCharge({ data: { code: initial.order.code } }),
    onError: (error: Error) => toast.error(error.message || "Falha ao gerar o PIX"),
  });
  const charge = pixMutation.data;

  useEffect(() => {
    if (realPix && !charge && !pixMutation.isPending && !pixMutation.isError) pixMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realPix]);

  useEffect(() => {
    const paid =
      initial.order.payment_status === "pago" || statusPoll.data?.order.payment_status === "pago";
    if (paid) {
      toast.success("Pagamento aprovado!");
      void navigate({ to: "/voucher/$code", params: { code: initial.order.code }, replace: true });
    }
  }, [initial.order.payment_status, initial.order.code, navigate, statusPoll.data]);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const mutation = useMutation({
    mutationFn: () => pay({ data: { code: initial.order.code } }),
    onSuccess: () => {
      toast.success("Pagamento aprovado!");
      void navigate({ to: "/voucher/$code", params: { code: initial.order.code }, replace: true });
    },
    onError: (error: Error) => toast.error(error.message || "Falha ao confirmar o pagamento"),
  });

  const copyPayload = charge?.qr_code ?? payload;
  const copy = async () => {
    await navigator.clipboard.writeText(copyPayload);
    setCopied(true);
    toast.success("Código PIX copiado");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b">
        <div className="mx-auto max-w-xl px-5 py-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pedido {initial.order.code}</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {isCard ? "Pagamento com cartão" : "Pague com PIX"}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-8">
        <div className="rounded-2xl border p-6 text-center">
          <p className="text-sm text-muted-foreground">Total a pagar</p>
          <p className="mt-1 text-4xl font-semibold">{formatBRL(initial.order.total_cents)}</p>

          {isCard ? (
            <form
              className="mt-6 space-y-4 text-left"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
            >
              <div>
                <Label htmlFor="card-number">Número do cartão</Label>
                <Input id="card-number" inputMode="numeric" placeholder="4111 1111 1111 1111" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="card-exp">Validade</Label>
                  <Input id="card-exp" placeholder="12/28" required />
                </div>
                <div>
                  <Label htmlFor="card-cvv">CVV</Label>
                  <Input id="card-cvv" inputMode="numeric" placeholder="123" required />
                </div>
              </div>
              <div>
                <Label htmlFor="card-name">Nome impresso</Label>
                <Input id="card-name" placeholder="Como está no cartão" required />
              </div>
              <Button type="submit" className="h-14 w-full text-base" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" /> Processando…
                  </>
                ) : (
                  `Pagar ${formatBRL(initial.order.total_cents)}`
                )}
              </Button>
            </form>
          ) : (
            <>
              <div className="mt-6 flex justify-center">
                {realPix && charge?.qr_code_base64 ? (
                  <img
                    src={`data:image/png;base64,${charge.qr_code_base64}`}
                    alt="QR Code PIX do Mercado Pago"
                    width={220}
                    height={220}
                    className="rounded-xl"
                  />
                ) : realPix && !charge ? (
                  <div className="grid size-[220px] place-items-center rounded-xl border">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Gerando PIX" />
                  </div>
                ) : (
                  <QrCode value={payload} size={220} title="QR Code PIX do pedido" />
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Expira em{" "}
                <span className="font-medium text-foreground">
                  {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
                </span>
              </p>
              <Button variant="outline" className="mt-4 w-full" onClick={() => void copy()}>
                {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
                {copied ? "Copiado" : "PIX copia e cola"}
              </Button>
              {realPix ? (
                <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Aguardando confirmação do banco…
                </p>
              ) : (
                <Button
                  className="mt-3 h-14 w-full text-base"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-5 animate-spin" /> Confirmando…
                    </>
                  ) : (
                    "Já fiz o pagamento"
                  )}
                </Button>
              )}
            </>
          )}
        </div>

        <Separator className="my-6" />

        <ul className="space-y-3">
          {initial.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 text-sm">
              <span aria-hidden className="text-xl">
                {item.emoji ?? "🍸"}
              </span>
              <span className="flex-1">
                {item.quantity} × {item.name}
              </span>
              <span className="font-medium">{formatBRL(item.unit_price_cents * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          {realPix
            ? "Pagamento processado pelo Mercado Pago com segurança."
            : "Ambiente de demonstração: nenhum valor real é cobrado."}
        </p>
      </main>
    </div>
  );
}
