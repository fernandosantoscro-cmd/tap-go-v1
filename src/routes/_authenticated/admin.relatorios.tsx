import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Package, Receipt, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useEstablishment, useLogs, useOrders, usePickups } from "@/lib/admin-db";
import { formatBRL, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/relatorios")({
  component: ReportsPage,
});

function ReportsPage() {
  const establishment = useEstablishment();
  const orders = useOrders(establishment.data?.id);
  const pickups = usePickups(establishment.data?.id);
  const logs = useLogs(establishment.data?.id);

  const paid = (orders.data ?? []).filter((order) => order.payment_status === "pago");
  const revenue = paid.reduce((sum, order) => sum + order.total_cents, 0);
  const itemsSold = paid.reduce(
    (sum, order) => sum + order.order_items.reduce((inner, item) => inner + item.quantity, 0),
    0,
  );
  const ticket = paid.length ? Math.round(revenue / paid.length) : 0;

  const byProduct = new Map<string, number>();
  paid.forEach((order) =>
    order.order_items.forEach((item) => {
      byProduct.set(item.product_name, (byProduct.get(item.product_name) ?? 0) + item.quantity);
    }),
  );
  const chartData = [...byProduct.entries()]
    .map(([name, quantidade]) => ({ name, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 8);

  const cards = [
    { label: "Faturamento pago", value: formatBRL(revenue), icon: TrendingUp },
    { label: "Pedidos pagos", value: String(paid.length), icon: Receipt },
    { label: "Itens vendidos", value: String(itemsSold), icon: Package },
    { label: "Ticket médio", value: formatBRL(ticket), icon: BarChart3 },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Relatórios</h1>
        <p className="mt-1 text-sm text-muted-foreground">Consolidado do estabelecimento desde o início da operação.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border bg-background p-5">
            <card.icon className="size-5 text-primary" aria-hidden />
            <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="text-xl font-semibold">Produtos mais vendidos</h2>
        <div className="mt-4 h-72">
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem vendas registradas ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-background p-6">
          <h2 className="text-xl font-semibold">Retiradas no balcão</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {(pickups.data ?? []).slice(0, 12).map((pickup) => (
              <li key={pickup.id} className="flex items-center justify-between gap-3">
                <span>
                  {pickup.quantity}× · {pickup.staff_name ?? "Funcionário"}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(pickup.created_at)}</span>
              </li>
            ))}
            {(pickups.data?.length ?? 0) === 0 && (
              <li className="text-muted-foreground">Nenhuma retirada registrada.</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border bg-background p-6">
          <h2 className="text-xl font-semibold">Auditoria</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {(logs.data ?? []).slice(0, 12).map((log) => (
              <li key={log.id} className="flex items-start justify-between gap-3">
                <span>{log.message ?? log.type}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
              </li>
            ))}
            {(logs.data?.length ?? 0) === 0 && <li className="text-muted-foreground">Sem eventos registrados.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
