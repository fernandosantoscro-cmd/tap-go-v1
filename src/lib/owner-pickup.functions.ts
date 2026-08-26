import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { OpenOrder, VoucherPayload } from "./tapgo-types";

export interface OwnerVoucherResult {
  voucher: VoucherPayload | null;
  error: string | null;
}

/** Descobre o estabelecimento do usuário logado (RLS garante que só veja o próprio). */
async function ownEstablishment(supabase: {
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string) => {
        limit: (n: number) => Promise<{ data: { id: string; name: string }[] | null; error: { message: string } | null }>;
      };
    };
  };
}) {
  const { data, error } = await supabase.from("establishments").select("id, name").order("created_at").limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export const ownerFetchVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => ({ code: String(data.code).slice(0, 32) }))
  .handler(async ({ data, context }): Promise<OwnerVoucherResult> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const mine = await ownEstablishment(supabase);
    if (!mine) return { voucher: null, error: "Nenhum estabelecimento encontrado nesta conta." };

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, establishment_id")
      .ilike("code", data.code)
      .maybeSingle();
    if (error) return { voucher: null, error: error.message };
    if (!order) return { voucher: null, error: `Voucher não encontrado em ${mine.name}. Confirme se o QR Code é deste estabelecimento.` };
    if (order.establishment_id !== mine.id) {
      return { voucher: null, error: `Este voucher não é de ${mine.name}. Ele pertence a outro estabelecimento.` };
    }

    const { data: voucher, error: voucherError } = await supabase.rpc("get_voucher", { p_code: data.code });
    if (voucherError) return { voucher: null, error: voucherError.message };
    return { voucher: (voucher as VoucherPayload | null) ?? null, error: null };
  });

export const ownerRegisterPickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; items: { item_id: string; quantity: number }[] }) => ({
    code: String(data.code).slice(0, 32),
    items: (data.items ?? []).slice(0, 40).map((entry) => ({
      item_id: String(entry.item_id),
      quantity: Math.max(0, Math.min(999, Number(entry.quantity) || 0)),
    })),
  }))
  .handler(async ({ data, context }): Promise<OwnerVoucherResult> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const mine = await ownEstablishment(supabase);
    if (!mine) return { voucher: null, error: "Nenhum estabelecimento encontrado nesta conta." };

    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("pin")
      .eq("establishment_id", mine.id)
      .eq("active", true)
      .order("created_at")
      .limit(1);
    if (staffError) return { voucher: null, error: staffError.message };
    const pin = staff?.[0]?.pin as string | undefined;
    if (!pin) return { voucher: null, error: "Cadastre um funcionário em Equipe para registrar retiradas." };

    const { data: result, error } = await supabase.rpc("register_pickup", {
      p_pin: pin,
      p_order_code: data.code,
      p_items: data.items,
    });
    if (error) return { voucher: null, error: error.message };
    return { voucher: (result as VoucherPayload | null) ?? null, error: null };
  });

/** Marca um item específico do pedido como pronto/entregue (cozinha). */
export const ownerSetItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; itemId: string; status: string }) => ({
    orderId: String(data.orderId),
    itemId: String(data.itemId),
    status: ["recebido", "preparando", "pronto", "entregue"].includes(data.status) ? data.status : "pronto",
  }))
  .handler(async ({ data, context }): Promise<{ error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const { error } = await supabase.rpc("owner_set_order_status", {
      p_order_id: data.orderId,
      p_status: data.status,
      p_item_id: data.itemId,
    });
    return { error: error ? error.message : null };
  });

/** Marca um item como pronto usando o código do pedido (usado pelo console de retirada). */
export const ownerSetItemStatusByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; itemId: string; status?: string }) => ({
    code: String(data.code).slice(0, 32),
    itemId: String(data.itemId),
    status: ["recebido", "preparando", "pronto", "entregue"].includes(String(data.status)) ? String(data.status) : "pronto",
  }))
  .handler(async ({ data, context }): Promise<{ error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .ilike("code", data.code)
      .maybeSingle();
    if (orderError) return { error: orderError.message };
    if (!order) return { error: "Pedido não encontrado nesta conta." };

    const { error } = await supabase.rpc("owner_set_order_status", {
      p_order_id: order.id,
      p_status: data.status,
      p_item_id: data.itemId,
    });
    return { error: error ? error.message : null };
  });

/** Lista os pedidos pagos com itens pendentes do estabelecimento da conta logada. */
export const ownerListOpenOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpenOrder[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const { data: rows, error } = await supabase
      .from("orders")
      .select(
        "code, status, total_cents, paid_at, created_at, customer_name, menus(name), events(name), order_items(id, product_name, emoji, unit_price_cents, quantity, ready_quantity, delivered_quantity, prep_minutes, requires_prep, status, created_at)",
      )
      .eq("payment_status", "pago")
      .neq("status", "cancelado")
      .order("paid_at", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((rows ?? []) as any[])
      .map((row) => ({
        code: row.code as string,
        status: row.status,
        total_cents: row.total_cents as number,
        paid_at: row.paid_at as string | null,
        created_at: row.created_at as string,
        customer_name: (row.customer_name ?? null) as string | null,
        menu_name: (row.menus?.name ?? null) as string | null,
        event_name: (row.events?.name ?? null) as string | null,
        items: // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((row.order_items ?? []) as any[])
            .slice()
            .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
            .map((item) => {
              const quantity = item.quantity as number;
              const ready = (item.ready_quantity ?? 0) as number;
              const delivered = (item.delivered_quantity ?? 0) as number;
              return {
                id: item.id as string,
                name: item.product_name as string,
                emoji: (item.emoji ?? null) as string | null,
                unit_price_cents: item.unit_price_cents as number,
                quantity,
                ready_quantity: ready,
                delivered_quantity: delivered,
                available_quantity: Math.max(0, ready - delivered),
                preparing_quantity: Math.max(0, quantity - ready),
                remaining_quantity: Math.max(0, quantity - delivered),
                prep_minutes: item.prep_minutes as number,
                requires_prep: item.requires_prep as boolean,
                status: item.status,
              };
            }),
      }))
      .filter((order) => order.items.some((item) => item.remaining_quantity > 0)) as OpenOrder[];
  });

/** Libera uma quantidade específica do item como pronta (painel do dono). */
export const ownerSetReadyQuantity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; itemId: string; quantity: number }) => ({
    code: String(data.code).slice(0, 32),
    itemId: String(data.itemId),
    quantity: Math.max(0, Math.min(999, Number(data.quantity) || 0)),
  }))
  .handler(async ({ data, context }): Promise<{ error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .ilike("code", data.code)
      .maybeSingle();
    if (orderError) return { error: orderError.message };
    if (!order) return { error: "Pedido não encontrado nesta conta." };

    const { error } = await supabase.rpc("owner_set_ready_quantity", {
      p_order_id: order.id,
      p_item_id: data.itemId,
      p_quantity: data.quantity,
    });
    return { error: error ? error.message : null };
  });

/** Busca pedidos ativos pelo CPF do cliente (fallback sem QR Code). */
export const ownerFindOrdersByDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { document: string }) => ({
    document: String(data.document).replace(/\D/g, "").slice(0, 11),
  }))
  .handler(async ({ data, context }): Promise<{ orders: VoucherPayload[]; error: string | null }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const mine = await ownEstablishment(supabase);
    if (!mine) return { orders: [], error: "Nenhum estabelecimento encontrado nesta conta." };

    const { data: result, error } = await supabase.rpc("owner_find_orders_by_document", {
      p_establishment_id: mine.id,
      p_document: data.document,
    });
    if (error) return { orders: [], error: error.message };
    return { orders: (result as VoucherPayload[] | null) ?? [], error: null };
  });

