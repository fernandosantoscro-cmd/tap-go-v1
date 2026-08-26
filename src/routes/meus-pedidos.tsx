import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, QrCode, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { forgetOrder, listMyOrders, type StoredOrder } from "@/lib/my-orders";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — TapGo" },
      {
        name: "description",
        content: "Veja todos os seus vouchers TapGo neste aparelho, com o status de preparo e o QR Code de retirada.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Meus pedidos — TapGo" },
      { property: "og:description", content: "Seus vouchers ativos e finalizados em um só lugar." },
    ],
  }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);

  useEffect(() => {
    const sync = () => setOrders(listMyOrders());
    sync();
    window.addEventListener("tapgo:my-orders", sync);
    return () => window.removeEventListener("tapgo:my-orders", sync);
  }, []);

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b">
        <div className="mx-auto max-w-xl px-5 py-6">
          <p className="font-display text-lg font-semibold">
            Tap<span className="text-primary">Go</span>
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Meus pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os vouchers feitos neste celular. Toque em um pedido para abrir o QR Code e ver o preparo de cada
            item.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-8">
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum pedido por aqui ainda. Escaneie o QR Code do cardápio para fazer o primeiro.
          </p>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.code} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold tracking-[0.2em]">{order.code}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.establishment ?? "Estabelecimento"} · {formatBRL(order.total_cents)} ·{" "}
                      {new Date(order.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remover pedido ${order.code} desta lista`}
                    onClick={() => forgetOrder(order.code)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <Button asChild className="mt-3 h-12 w-full">
                  <Link to="/voucher/$code" params={{ code: order.code }}>
                    <QrCode className="mr-2 size-4" aria-hidden />
                    Abrir voucher e status
                    <ArrowRight className="ml-2 size-4" aria-hidden />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
