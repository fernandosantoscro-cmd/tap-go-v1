import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { VoucherPayload } from "./tapgo-types";

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
