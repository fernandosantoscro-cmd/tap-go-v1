import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Download, Package, Receipt, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DateRangeFilter } from "@/components/date-range-filter";
import { Button } from "@/components/ui/button";
import { useEstablishment, useLogs, useOrders, usePickups } from "@/lib/admin-db";
import { buildRange, downloadCsv, previousRange, toCsv, type DateRange } from "@/lib/date-range";
import { formatBRL, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/relatorios")({
  component: ReportsPage,
});

function ReportsPage() {
  const establishment = useEstablishment();
  const [range, setRange] = useState<DateRange>(() => buildRange("30d"));
  const [custom, setCustom] = useState({ from: "", to: "" });
  const orders = useOrders(establishment.data?.id, range);
  const previous = useOrders(establishment.data?.id, previousRange(range));
  const pickups = usePickups(establishment.data?.id, range);
  const logs = useLogs(establishment.data?.id, range);

  const paid = (orders.data ?? []).filter((order) => order.payment_status === "pago");
  const revenue = paid.reduce((sum, order) => sum + order.total_cents, 0);
  const itemsSold = paid.reduce(
    (sum, order) => sum + order.order_items.reduce((inner, item) => inner + item.quantity, 0),
    0,
  );
  const ticket = paid.length ? Math.round(revenue / paid.length) : 0;

  const previousRevenue = (previous.data ?? [])
    .filter((order) => order.payment_status === "pago")
    .reduce((sum, order) => sum + order.total_cents, 0);
  const delta = previousRevenue ? Math.round(((revenue - previousRevenue) / previousRevenue) * 100) : null;

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

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Produto", "Quantidade"],
      ...[...byProduct.entries()].sort((a, b) => b[1] - a[1]),
      [],
      ["Faturamento (R$)", (revenue / 100).toFixed(2).replace(".", ",")],
      ["Pedidos pagos", paid.length],
      ["Itens vendidos", itemsSold],
      ["Ticket médio (R$)", (ticket / 100).toFixed(2).replace(".", ",")],
      ["Período", range.label],
    ];
    downloadCsv(`tapgo-relatorio-${range.key}.csv`, toCsv(rows));
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {range.label}
            {delta !== null && (
              <>
                {" · "}
                <span className={delta >= 0 ? "text-success" : "text-destructive"}>
                  {delta >= 0 ? "+" : ""}
                  {delta}% vs. período anterior
                </span>
              </>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 size-4" /> Exportar CSV
        </Button>
      </header>

      <DateRangeFilter value={range} onChange={setRange} custom={custom} onCustomChange={setCustom} />


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
          {(() => {
            const byStation = new Map<string, number>();
            for (const pickup of pickups.data ?? []) {
              const key = pickup.station ?? "Sem estande";
              byStation.set(key, (byStation.get(key) ?? 0) + pickup.quantity);
            }
            return byStation.size > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {[...byStation.entries()].map(([station, quantity]) => (
                  <li key={station} className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                    {station}: <strong className="text-foreground">{quantity}</strong> itens
                  </li>
                ))}
              </ul>
            ) : null;
          })()}
          <ul className="mt-4 space-y-3 text-sm">
            {(pickups.data ?? []).slice(0, 12).map((pickup) => (
              <li key={pickup.id} className="flex items-center justify-between gap-3">
                <span>
                  {pickup.quantity}× · {pickup.staff_name ?? "Funcionário"}
                  {pickup.station ? ` · ${pickup.station}` : ""}
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
