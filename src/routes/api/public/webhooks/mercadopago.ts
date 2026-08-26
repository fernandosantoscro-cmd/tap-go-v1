import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook do Mercado Pago: chamado quando um pagamento muda de status.
 * Segurança: o payload nunca é confiado diretamente — o status é sempre
 * revalidado na API do Mercado Pago com o token do estabelecimento.
 */
export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          type?: string;
          data?: { id?: string | number };
        } | null;
        const paymentId = body?.data?.id ? String(body.data.id) : null;
        if (!paymentId) return new Response("ignored", { status: 200 });

        const server = await import("@/lib/integrations.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabaseAdmin as any;

        const { data: order } = await db
          .from("orders")
          .select("id, code, establishment_id, payment_status")
          .eq("payment_provider_ref", paymentId)
          .maybeSingle();
        if (!order) return new Response("unknown payment", { status: 200 });

        const integration = await server.getIntegration(order.establishment_id, "mercadopago");
        const token = String(integration?.credentials?.["access_token"] ?? "");
        if (!token) return new Response("no credentials", { status: 200 });

        const payment = await server.fetchMercadoPagoPayment(paymentId, token);
        if (!payment || payment.external_reference?.toLowerCase() !== String(order.code).toLowerCase()) {
          return new Response("mismatch", { status: 200 });
        }

        if (payment.status === "approved" && order.payment_status !== "pago") {
          await db.rpc("confirm_payment", {
            p_order_code: order.code,
            p_reference: `mp_${paymentId}`,
          });
          await server.logIntegrationEvent(
            order.establishment_id,
            "mercadopago",
            "payment.approved",
            { order: order.code, payment_id: paymentId },
            "ok",
            undefined,
            "inbound",
          );
          await server.onPaymentConfirmed(order.code);
        } else {
          await server.logIntegrationEvent(
            order.establishment_id,
            "mercadopago",
            `payment.${payment.status}`,
            { order: order.code, payment_id: paymentId },
            "ok",
            undefined,
            "inbound",
          );
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
