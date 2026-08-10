import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Bell, CheckCircle2, Clock, Download, Flame, PartyPopper, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatBRL, ORDER_STATUS_LABEL } from "@/lib/format";
import { downloadReceipt, shareReceipt } from "@/lib/receipt";
import { fetchVoucher } from "@/lib/tapgo.functions";
import type { VoucherItem, VoucherPayload } from "@/lib/tapgo-types";
import { useOrderRealtime } from "@/lib/use-order-realtime";
import { isReadyForPickup, kitchenItemLabel, splitVoucherItems } from "@/lib/voucher-groups";



export const Route = createFileRoute("/voucher/$code")({
  loader: async ({ params }) => {
    const voucher = await fetchVoucher({ data: { code: params.code } });
    if (!voucher) throw notFound();
    return voucher;
  },
  head: () => ({
    meta: [
      { title: "Seu voucher de retirada — TapGo" },
      { name: "description", content: "Apresente este QR Code no balcão para retirar seus produtos, no seu ritmo." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Seu voucher de retirada — TapGo" },
      { property: "og:description", content: "Apresente o QR Code no balcão para retirar seus produtos." },
    ],
  }),
  errorComponent: () => <VoucherUnavailable />,
  notFoundComponent: () => <VoucherUnavailable />,
  component: VoucherPage,
});

function VoucherUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Voucher não encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Confira o link ou procure um funcionário do evento.</p>
      </div>
    </div>
  );
}

function VoucherPage() {
  const initial = Route.useLoaderData() as VoucherPayload;
  const { code } = Route.useParams();

  const { data, refetch } = useQuery({
    queryKey: ["voucher", code],
    queryFn: () => fetchVoucher({ data: { code } }),
    initialData: initial,
    refetchInterval: 15000,
  });

  const { permission, enableAlerts } = useOrderRealtime(code, () => void refetch());


  const voucher = (data ?? initial) as VoucherPayload;
  const totalItems = voucher.items.reduce((sum, item) => sum + item.quantity, 0);
  const deliveredItems = voucher.items.reduce((sum, item) => sum + item.delivered_quantity, 0);
  const complete = deliveredItems >= totalItems;
  const voucherUrl =
    typeof window === "undefined" ? `/voucher/${code}` : `${window.location.origin}/voucher/${code}`;
  const [busy, setBusy] = useState<"share" | "download" | null>(null);

  async function handleReceipt(action: "share" | "download") {
    setBusy(action);
    try {
      if (action === "download") {
        await downloadReceipt(voucher);
        toast.success("Comprovante baixado");
      } else {
        const result = await shareReceipt(voucher);
        toast.success(
          result === "shared"
            ? "Comprovante compartilhado"
            : result === "copied"
              ? "Link do comprovante copiado"
              : "Comprovante baixado",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o comprovante");
    } finally {
      setBusy(null);
    }
  }

  const { counter: counterItems, kitchen: kitchenItems } = splitVoucherItems(voucher);
  const readyNow = voucher.items.filter((item) => item.available_quantity > 0 && isReadyForPickup(item));
  const preparing = voucher.items.filter((item) => item.available_quantity > 0 && !isReadyForPickup(item));

  function renderItem(item: VoucherItem) {
    const done = item.available_quantity === 0;
    const ready = isReadyForPickup(item);
    return (
      <li key={item.id} className="flex items-center gap-3 rounded-2xl border p-4">
        <span aria-hidden className="text-2xl">
          {item.emoji ?? (item.requires_prep ? "🍽️" : "🍸")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {done
              ? `${item.quantity} retirado${item.quantity > 1 ? "s" : ""}`
              : `${item.available_quantity} de ${item.quantity} disponível para retirada`}
          </p>
        </div>
        {done ? (
          <CheckCircle2 className="size-5 text-success" aria-label="Item retirado" />
        ) : item.requires_prep ? (
          <span
            className={`flex items-center gap-1 text-xs ${ready ? "text-success" : "text-muted-foreground"}`}
          >
            <Clock className="size-3.5" aria-hidden /> {kitchenItemLabel(item, voucher.order.paid_at)}
          </span>
        ) : null}
      </li>
    );
  }



  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b bg-secondary/50">
        <div className="mx-auto max-w-xl px-5 py-6 text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {voucher.establishment?.name ?? "TapGo"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {complete ? "Pedido retirado" : "Voucher de retirada"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {complete
              ? "Todos os itens deste pedido já foram entregues."
              : "Mostre este QR Code no balcão. Você pode retirar aos poucos."}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-8">
        {!complete && permission === "default" && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border p-4">
            <div>
              <p className="font-medium">Avisar quando ficar pronto</p>
              <p className="text-sm text-muted-foreground">
                Receba um alerta na hora, mesmo com a tela desligada.
              </p>
            </div>
            <Button size="sm" onClick={() => void enableAlerts()}>
              <Bell className="mr-2 size-4" /> Ativar
            </Button>
          </div>
        )}

        {!complete && readyNow.length > 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
            <PartyPopper className="mt-0.5 size-5 text-primary" aria-hidden />
            <div>
              <p className="font-medium">
                {readyNow.length === 1 ? "Seu item está pronto" : `${readyNow.length} itens estão prontos`} — vá ao balcão
              </p>
              <p className="text-sm text-muted-foreground">
                {readyNow.map((item) => item.name).join(", ")}
                {preparing.length > 0 ? " · o restante ainda está em preparo." : ""}
              </p>
            </div>
          </div>
        )}
        <div className="rounded-3xl border p-6 text-center">
          <div className="flex justify-center">
            <QrCode value={voucherUrl} size={252} title={`QR Code do pedido ${voucher.order.code}`} />
          </div>
          <p className="mt-4 font-display text-2xl font-semibold tracking-[0.2em]">{voucher.order.code}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge variant={complete ? "secondary" : "default"}>{ORDER_STATUS_LABEL[voucher.order.status]}</Badge>
            <Badge variant="outline">{formatBRL(voucher.order.total_cents)}</Badge>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Retirado</span>
              <span className="font-medium">
                {deliveredItems} de {totalItems} itens
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={deliveredItems} aria-valuemin={0} aria-valuemax={totalItems}>
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${totalItems ? (deliveredItems / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => void handleReceipt("download")}>
            <Download className="mr-2 size-4" /> Baixar comprovante
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => void handleReceipt("share")}>
            <Share2 className="mr-2 size-4" /> Enviar comprovante
          </Button>
        </div>

        <Separator className="my-6" />


        {counterItems.length > 0 && (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Retire agora no balcão
            </h2>
            <ul className="mt-4 space-y-3">{counterItems.map((item) => renderItem(item))}</ul>
          </>
        )}

        {kitchenItems.length > 0 && (
          <>
            <h2 className="mt-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              <Flame className="size-3.5" aria-hidden /> Cozinha
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Volte ao balcão com o mesmo QR Code quando estiver pronto.
            </p>
            <ul className="mt-4 space-y-3">{kitchenItems.map((item) => renderItem(item))}</ul>
          </>
        )}

        {complete && (
          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <PartyPopper className="size-4" aria-hidden /> Obrigado e bom evento!
          </p>
        )}
      </main>
    </div>
  );
}
