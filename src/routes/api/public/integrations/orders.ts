import { createFileRoute } from "@tanstack/react-router";

/**
 * API de leitura para a plataforma/ERP do estabelecimento.
 * Autenticação: header `x-api-key` com a chave gerada em Configurações → Integrações.
 * Retorna apenas pedidos pagos do estabelecimento dono da chave.
 */
export const Route = createFileRoute("/api/public/integrations/orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = request.headers.get("x-api-key") ?? "";
        if (apiKey.length < 16) return new Response("Unauthorized", { status: 401 });

        const server = await import("@/lib/integrations.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;

        const { data: integration } = await db
          .from("establishment_integrations")
          .select("establishment_id, credentials, enabled")
          .eq("provider", "webhook_custom")
          .eq("enabled", true);
        const match = (integration as { establishment_id: string; credentials: { api_key?: string } }[] | null)?.find(
          (row) => row.credentials?.api_key === apiKey,
        );
        if (!match) return new Response("Unauthorized", { status: 401 });

        const { data: orders } = await db
          .from("orders")
          .select("code, status, payment_status, payment_method, total_cents, customer_name, paid_at, created_at, order_items(product_name, quantity, unit_price_cents, ready_quantity, delivered_quantity)")
          .eq("establishment_id", match.establishment_id)
          .eq("payment_status", "pago")
          .order("paid_at", { ascending: false })
          .limit(100);

        await server.logIntegrationEvent(
          match.establishment_id,
          "webhook_custom",
          "api.orders",
          { count: orders?.length ?? 0 },
          "ok",
          undefined,
          "inbound",
        );

        return Response.json({ orders: orders ?? [] });
      },
    },
  },
});
