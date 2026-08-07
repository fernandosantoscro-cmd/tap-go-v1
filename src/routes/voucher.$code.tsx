import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { CheckCircle2, Clock, PartyPopper } from "lucide-react";

import { QrCode } from "@/components/qr-code";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatBRL, ORDER_STATUS_LABEL } from "@/lib/format";
import { fetchVoucher } from "@/lib/tapgo.functions";
import type { VoucherPayload } from "@/lib/tapgo-types";

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

  const { data } = useQuery({
    queryKey: ["voucher", code],
    queryFn: () => fetchVoucher({ data: { code } }),
    initialData: initial,
    refetchInterval: 5000,
  });

  const voucher = (data ?? initial) as VoucherPayload;
  const totalItems = voucher.items.reduce((sum, item) => sum + item.quantity, 0);
  const deliveredItems = voucher.items.reduce((sum, item) => sum + item.delivered_quantity, 0);
  const complete = deliveredItems >= totalItems;
  const voucherUrl =
    typeof window === "undefined" ? `/voucher/${code}` : `${window.location.origin}/voucher/${code}`;

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
            <Progress value={totalItems ? (deliveredItems / totalItems) * 100 : 0} className="mt-2" />
          </div>
        </div>

        <Separator className="my-6" />

        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Itens</h2>
        <ul className="mt-4 space-y-3">
          {voucher.items.map((item) => {
            const done = item.available_quantity === 0;
            return (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl border p-4">
                <span aria-hidden className="text-2xl">
                  {item.emoji ?? "🍸"}
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
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden /> {item.prep_minutes} min
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        {complete && (
          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <PartyPopper className="size-4" aria-hidden /> Obrigado e bom evento!
          </p>
        )}
      </main>
    </div>
  );
}
