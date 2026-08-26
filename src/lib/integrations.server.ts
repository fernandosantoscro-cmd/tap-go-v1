/**
 * Helpers server-side de integrações externas (pagamento, fiscal, webhooks).
 * NUNCA importar em componentes/rotas client — usar via integrations.functions.ts.
 */

export interface IntegrationRow {
  id: string;
  establishment_id: string;
  provider: string;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  enabled: boolean;
}

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Tabelas novas podem não estar nos tipos gerados ainda.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

export async function getIntegration(
  establishmentId: string,
  provider: string,
): Promise<IntegrationRow | null> {
  const db = await adminDb();
  const { data } = await db
    .from("establishment_integrations")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("provider", provider)
    .maybeSingle();
  return (data as IntegrationRow | null) ?? null;
}

export async function logIntegrationEvent(
  establishmentId: string | null,
  provider: string,
  eventType: string,
  payload: Record<string, unknown>,
  status: "ok" | "erro" = "ok",
  error?: string,
  direction: "inbound" | "outbound" = "outbound",
) {
  try {
    const db = await adminDb();
    await db.from("integration_events").insert({
      establishment_id: establishmentId,
      provider,
      direction,
      event_type: eventType,
      payload,
      status,
      error: error ?? null,
    });
  } catch {
    /* log é best-effort */
  }
}

async function markIntegration(
  establishmentId: string,
  provider: string,
  status: string,
  error: string | null,
) {
  const db = await adminDb();
  await db
    .from("establishment_integrations")
    .update({ last_status: status, last_error: error })
    .eq("establishment_id", establishmentId)
    .eq("provider", provider);
}

export interface OrderForIntegration {
  id: string;
  code: string;
  establishment_id: string;
  total_cents: number;
  customer_name: string | null;
  customer_document: string | null;
  payment_method: string | null;
  items: { product_name: string; quantity: number; unit_price_cents: number }[];
}

export async function loadOrderByCode(code: string): Promise<OrderForIntegration | null> {
  const db = await adminDb();
  const { data } = await db
    .from("orders")
    .select("id, code, establishment_id, total_cents, customer_name, customer_document, payment_method, order_items(product_name, quantity, unit_price_cents)")
    .ilike("code", code)
    .maybeSingle();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  return { ...row, items: row.order_items ?? [] };
}

// ---------------------------------------------------------------------------
// Webhooks de saída (ERP / plataforma do estabelecimento)
// ---------------------------------------------------------------------------

export async function dispatchOutboundWebhook(
  establishmentId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const integration = await getIntegration(establishmentId, "webhook_custom");
  const url = integration?.enabled ? String(integration.settings?.url ?? "") : "";
  if (!integration || !url) return;

  const body = JSON.stringify({ type: eventType, timestamp: new Date().toISOString(), data: payload });
  const secret = String(integration.credentials?.api_key ?? "");
  const { createHmac } = await import("crypto");
  const signature = createHmac("sha256", secret || "tapgo").update(body).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tapgo-event": eventType,
        "x-tapgo-signature": signature,
      },
      body,
    });
    await logIntegrationEvent(establishmentId, "webhook_custom", eventType, payload, res.ok ? "ok" : "erro",
      res.ok ? undefined : `HTTP ${res.status}`);
    await markIntegration(establishmentId, "webhook_custom", res.ok ? "ok" : "erro", res.ok ? null : `HTTP ${res.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de rede";
    await logIntegrationEvent(establishmentId, "webhook_custom", eventType, payload, "erro", message);
    await markIntegration(establishmentId, "webhook_custom", "erro", message);
  }
}

// ---------------------------------------------------------------------------
// Mercado Pago (PIX / cartão)
// ---------------------------------------------------------------------------

export interface PixCharge {
  payment_id: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
}

export async function createMercadoPagoPix(
  order: OrderForIntegration,
  integration: IntegrationRow,
  notificationUrl: string,
): Promise<PixCharge> {
  const token = String(integration.credentials?.access_token ?? "");
  if (!token) throw new Error("Access token do Mercado Pago não configurado");

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": order.code,
    },
    body: JSON.stringify({
      transaction_amount: order.total_cents / 100,
      payment_method_id: "pix",
      description: `Pedido ${order.code}`,
      external_reference: order.code,
      notification_url: notificationUrl,
      payer: {
        email: "cliente@tapgo.app",
        first_name: order.customer_name ?? "Cliente",
        identification: order.customer_document
          ? { type: "CPF", number: order.customer_document }
          : undefined,
      },
    }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = String((json as { message?: string }).message ?? `Mercado Pago HTTP ${res.status}`);
    await markIntegration(order.establishment_id, "mercadopago", "erro", message);
    throw new Error(message);
  }

  await markIntegration(order.establishment_id, "mercadopago", "ok", null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poi = (json as any).point_of_interaction?.transaction_data ?? {};
  return {
    payment_id: String(json.id ?? ""),
    qr_code: poi.qr_code ?? null,
    qr_code_base64: poi.qr_code_base64 ?? null,
    ticket_url: poi.ticket_url ?? null,
  };
}

export async function fetchMercadoPagoPayment(paymentId: string, accessToken: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: number; status: string; external_reference?: string };
}

// ---------------------------------------------------------------------------
// Fiscal (NFE.io / Focus NFe / eNotas)
// ---------------------------------------------------------------------------

interface FiscalResult {
  provider_ref: string | null;
  number: string | null;
  pdf_url: string | null;
  xml_url: string | null;
}

async function issueNfeio(order: OrderForIntegration, integration: IntegrationRow): Promise<FiscalResult> {
  const apiKey = String(integration.credentials?.api_key ?? "");
  const companyId = String(integration.credentials?.company_id ?? "");
  if (!apiKey || !companyId) throw new Error("Configure API key e Company ID da NFE.io");

  const res = await fetch(
    `https://api.nfe.io/v1/companies/${companyId}/serviceinvoices?apikey=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cityServiceCode: String(integration.settings?.city_service_code ?? "0107"),
        description: `Pedido ${order.code} — consumo no estabelecimento`,
        servicesAmount: order.total_cents / 100,
        borrower: order.customer_document
          ? { federalTaxNumber: Number(order.customer_document), name: order.customer_name ?? "Cliente" }
          : undefined,
      }),
    },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(String(json?.message ?? `NFE.io HTTP ${res.status}`));
  const id = json?.id ?? json?.flow?.id ?? null;
  return {
    provider_ref: id ? String(id) : null,
    number: json?.number ? String(json.number) : null,
    pdf_url: id ? `https://api.nfe.io/v1/companies/${companyId}/serviceinvoices/${id}/pdf?apikey=${apiKey}` : null,
    xml_url: id ? `https://api.nfe.io/v1/companies/${companyId}/serviceinvoices/${id}/xml?apikey=${apiKey}` : null,
  };
}

async function issueFocusNfe(order: OrderForIntegration, integration: IntegrationRow): Promise<FiscalResult> {
  const token = String(integration.credentials?.api_key ?? "");
  if (!token) throw new Error("Configure o token da Focus NFe");
  const homologacao = integration.settings?.ambiente !== "producao";
  const base = "https://api.focusnfe.com.br";
  const ref = `tapgo-${order.code.toLowerCase()}`;
  const auth = btoa(`${token}:`);

  const res = await fetch(`${base}/v2/nfce?ref=${ref}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      natureza_operacao: "Venda de mercadoria",
      forma_pagamento: order.payment_method === "pix" ? "17" : "03",
      tipo_documento: "1",
      finalidade_emissao: "1",
      consumidor_final: "1",
      presenca_comprador: "9",
      modalidade_frete: "9",
      ...(homologacao ? { nome_destinatario: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" } : {}),
      cpf_destinatario: order.customer_document ?? "",
      itens: order.items.map((item, index) => ({
        numero_item: String(index + 1),
        codigo_produto: String(index + 1).padStart(4, "0"),
        descricao: item.product_name,
        cfop: "5102",
        unidade_comercial: "un",
        quantidade_comercial: item.quantity,
        valor_unitario_comercial: (item.unit_price_cents / 100).toFixed(2),
        codigo_ncm: "00000000",
        unidade_tributavel: "un",
        quantidade_tributavel: item.quantity,
        valor_unitario_tributavel: (item.unit_price_cents / 100).toFixed(2),
        valor_bruto: ((item.unit_price_cents * item.quantity) / 100).toFixed(2),
        icms_situacao_tributaria: "102",
        icms_origem: "0",
        pis_situacao_tributaria: "07",
        cofins_situacao_tributaria: "07",
      })),
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(String(json?.erros?.[0]?.mensagem ?? json?.mensagem ?? `Focus NFe HTTP ${res.status}`));
  return {
    provider_ref: ref,
    number: json?.numero ? String(json.numero) : null,
    pdf_url: json?.caminho_danfe ? `${base}${json.caminho_danfe}` : null,
    xml_url: json?.caminho_xml ? `${base}${json.caminho_xml}` : null,
  };
}

async function issueEnotas(order: OrderForIntegration, integration: IntegrationRow): Promise<FiscalResult> {
  const apiKey = String(integration.credentials?.api_key ?? "");
  const companyId = String(integration.credentials?.company_id ?? "");
  if (!apiKey || !companyId) throw new Error("Configure API key e Empresa ID da eNotas");
  const auth = btoa(apiKey);

  const res = await fetch(`https://api.enotas.com.br/v2/empresas/${companyId}/nfes`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: `tapgo-${order.code.toLowerCase()}`,
      ambienteEmissao: integration.settings?.ambiente === "producao" ? "Producao" : "Homologacao",
      tipo: "NFCe",
      consumidor: order.customer_document
        ? { cpfCnpj: order.customer_document, nome: order.customer_name ?? "Cliente" }
        : undefined,
      itens: order.items.map((item) => ({
        descricao: item.product_name,
        cfop: "5102",
        unidadeMedida: "UN",
        quantidade: item.quantity,
        valorUnitario: item.unit_price_cents / 100,
        valorTotal: (item.unit_price_cents * item.quantity) / 100,
      })),
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(String(json?.message ?? json?.erros?.[0]?.mensagem ?? `eNotas HTTP ${res.status}`));
  const id = json?.nfeId ?? json?.id ?? null;
  return {
    provider_ref: id ? String(id) : null,
    number: json?.numero ? String(json.numero) : null,
    pdf_url: id ? `https://api.enotas.com.br/v2/empresas/${companyId}/nfes/${id}/pdf` : null,
    xml_url: id ? `https://api.enotas.com.br/v2/empresas/${companyId}/nfes/${id}/xml` : null,
  };
}

const FISCAL_ADAPTERS: Record<string, (o: OrderForIntegration, i: IntegrationRow) => Promise<FiscalResult>> = {
  nfeio: issueNfeio,
  focusnfe: issueFocusNfe,
  enotas: issueEnotas,
};

/** Emite documento fiscal do pedido no provider configurado (se houver). */
export async function issueFiscalForOrder(orderCode: string): Promise<{ issued: boolean; error?: string }> {
  const order = await loadOrderByCode(orderCode);
  if (!order) return { issued: false, error: "Pedido não encontrado" };

  const integration = await getIntegration(order.establishment_id, "fiscal");
  if (!integration?.enabled) return { issued: false };
  if (integration.settings?.auto_issue === false) return { issued: false };

  const provider = String(integration.settings?.fiscal_provider ?? "nfeio");
  const adapter = FISCAL_ADAPTERS[provider];
  if (!adapter) return { issued: false, error: `Provider fiscal desconhecido: ${provider}` };

  const db = await adminDb();
  const { data: docRow } = await db
    .from("fiscal_documents")
    .insert({
      establishment_id: order.establishment_id,
      order_id: order.id,
      provider,
      status: "pendente",
    })
    .select("id")
    .single();
  const docId = (docRow as { id: string } | null)?.id;

  try {
    const result = await adapter(order, integration);
    if (docId) {
      await db.from("fiscal_documents").update({
        status: "emitida",
        number: result.number,
        pdf_url: result.pdf_url,
        xml_url: result.xml_url,
        provider_ref: result.provider_ref,
      }).eq("id", docId);
    }
    await db.from("orders").update({ fiscal_status: "emitida" }).eq("id", order.id);
    await markIntegration(order.establishment_id, "fiscal", "ok", null);
    await logIntegrationEvent(order.establishment_id, provider, "fiscal.emitida", {
      order: order.code,
      number: result.number,
    });
    await dispatchOutboundWebhook(order.establishment_id, "fiscal.issued", {
      order_code: order.code,
      number: result.number,
      pdf_url: result.pdf_url,
    });
    return { issued: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na emissão fiscal";
    if (docId) {
      await db.from("fiscal_documents").update({ status: "erro", error_message: message }).eq("id", docId);
    }
    await db.from("orders").update({ fiscal_status: "erro" }).eq("id", order.id);
    await markIntegration(order.establishment_id, "fiscal", "erro", message);
    await logIntegrationEvent(order.establishment_id, provider, "fiscal.erro", { order: order.code }, "erro", message);
    return { issued: false, error: message };
  }
}

/** Ponto único chamado quando um pagamento é confirmado (simulado ou real). */
export async function onPaymentConfirmed(orderCode: string) {
  const order = await loadOrderByCode(orderCode);
  if (!order) return;
  await dispatchOutboundWebhook(order.establishment_id, "order.paid", {
    order_code: order.code,
    total_cents: order.total_cents,
    payment_method: order.payment_method,
    customer_document: order.customer_document,
    items: order.items,
  });
  await issueFiscalForOrder(orderCode);
}
