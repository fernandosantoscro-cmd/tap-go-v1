import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface IntegrationSummary {
  provider: string;
  enabled: boolean;
  settings: Record<string, string | number | boolean | null>;
  last_status: string | null;
  last_error: string | null;
  has_credentials: boolean;
}

export const getIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IntegrationSummary[]> => {
    const { data, error } = await context.supabase.rpc("list_integrations");
    if (error) throw new Error(error.message);
    return (data as IntegrationSummary[] | null) ?? [];
  });

export const saveIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      provider: string;
      credentials?: Record<string, unknown>;
      settings?: Record<string, unknown>;
      enabled?: boolean;
    }) => ({
      provider: String(data.provider).slice(0, 40),
      credentials: data.credentials ?? {},
      settings: data.settings ?? {},
      enabled: Boolean(data.enabled),
    }),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("save_integration", {
      p_provider: data.provider,
      p_credentials: data.credentials as never,
      p_settings: data.settings as never,
      p_enabled: data.enabled,
    });
    if (error) throw new Error(error.message);
    return result;
  });

/** Testa a integração: ping no provider ou envio de evento de teste no webhook. */
export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { provider: string }) => ({ provider: String(data.provider).slice(0, 40) }))
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string }> => {
    const { data: est } = await context.supabase
      .from("establishments")
      .select("id")
      .eq("owner_id", context.userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!est) throw new Error("Estabelecimento não encontrado");

    const server = await import("./integrations.server");
    const integration = await server.getIntegration(est.id, data.provider);
    if (!integration) return { ok: false, message: "Integração não configurada" };

    if (data.provider === "mercadopago") {
      const token = String(integration.credentials?.["access_token"] ?? "");
      if (!token) return { ok: false, message: "Informe o access token" };
      const res = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok
        ? { ok: true, message: "Conectado ao Mercado Pago com sucesso" }
        : { ok: false, message: `Token inválido (HTTP ${res.status})` };
    }

    if (data.provider === "webhook_custom") {
      await server.dispatchOutboundWebhook(est.id, "test", { message: "Evento de teste do TapGo" });
      return { ok: true, message: "Evento de teste enviado — confira o log" };
    }

    return { ok: true, message: "Salvo. A emissão é validada no primeiro pedido pago." };
  });

/** Configuração de pagamento visível ao cliente na tela de pagamento. */
export const getPaymentConfig = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => ({ code: String(data.code).slice(0, 32) }))
  .handler(async ({ data }): Promise<{ realPix: boolean }> => {
    const server = await import("./integrations.server");
    const order = await server.loadOrderByCode(data.code);
    if (!order) return { realPix: false };
    const integration = await server.getIntegration(order.establishment_id, "mercadopago");
    return { realPix: Boolean(integration?.enabled && integration.credentials?.["access_token"]) };
  });

export interface PixChargeResult {
  payment_id: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
}

/** Gera cobrança PIX real no Mercado Pago para o pedido. */
export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => ({ code: String(data.code).slice(0, 32) }))
  .handler(async ({ data }): Promise<PixChargeResult> => {
    const server = await import("./integrations.server");
    const order = await server.loadOrderByCode(data.code);
    if (!order) throw new Error("Pedido não encontrado");
    const integration = await server.getIntegration(order.establishment_id, "mercadopago");
    if (!integration?.enabled) throw new Error("Pagamento real não está ativo neste estabelecimento");

    const origin = process.env["VITE_SITE_URL"] ?? "https://instant-retire.lovable.app";
    const charge = await server.createMercadoPagoPix(
      order,
      integration,
      `${origin}/api/public/webhooks/mercadopago`,
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as unknown as { from(t: string): { update(v: Record<string, unknown>): { eq(c: string, v: string): Promise<unknown> } } })
      .from("orders")
      .update({ payment_provider_ref: charge.payment_id })
      .eq("id", order.id);

    await server.logIntegrationEvent(order.establishment_id, "mercadopago", "pix.created", {
      order: order.code,
      payment_id: charge.payment_id,
    });
    return charge;
  });

export interface FiscalDocumentRow {
  id: string;
  order_id: string;
  provider: string;
  status: string;
  number: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  error_message: string | null;
  created_at: string;
}

export const listFiscalDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalDocumentRow[]> => {
    const { data, error } = await (context.supabase as unknown as {
      from(t: string): {
        select(s: string): { order(c: string, o: { ascending: boolean }): { limit(n: number): Promise<{ data: unknown; error: { message: string } | null }> } };
      };
    })
      .from("fiscal_documents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data as FiscalDocumentRow[] | null) ?? [];
  });

/** Reemite manualmente o documento fiscal de um pedido (dono). */
export const reissueFiscalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => ({ code: String(data.code).slice(0, 32) }))
  .handler(async ({ data, context }): Promise<{ issued: boolean; error?: string }> => {
    const { data: order } = await context.supabase
      .from("orders")
      .select("id, establishment_id")
      .ilike("code", data.code)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado");
    const { data: allowed } = await context.supabase.rpc("owns_establishment", {
      p_id: order.establishment_id,
    });
    if (!allowed) throw new Error("Sem permissão");
    const server = await import("./integrations.server");
    return server.issueFiscalForOrder(data.code);
  });
