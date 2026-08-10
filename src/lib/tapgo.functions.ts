import { createServerFn } from "@tanstack/react-start";

import type { MenuPayload, VoucherPayload, StaffSession, CartLine, OpenOrder } from "./tapgo-types";

export const fetchMenu = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => ({ code: String(data.code).slice(0, 32) }))
  .handler(async ({ data }): Promise<MenuPayload | null> => {
    const { publicDb } = await import("./public-db.server");
    const { data: result, error } = await publicDb().rpc("get_menu_by_code", { p_code: data.code });
    if (error) throw new Error(error.message);
    return (result as MenuPayload | null) ?? null;
  });

export const fetchVoucher = createServerFn({ method: "GET" })
  .inputValidator((data: { code: string }) => ({ code: String(data.code).slice(0, 32) }))
  .handler(async ({ data }): Promise<VoucherPayload | null> => {
    const { publicDb } = await import("./public-db.server");
    const { data: result, error } = await publicDb().rpc("get_voucher", { p_code: data.code });
    if (error) throw new Error(error.message);
    return (result as VoucherPayload | null) ?? null;
  });

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { menuCode: string; items: CartLine[]; paymentMethod: string }) => {
    if (!Array.isArray(data.items) || data.items.length === 0) throw new Error("Carrinho vazio");
    return {
      menuCode: String(data.menuCode).slice(0, 32),
      paymentMethod: ["pix", "card"].includes(data.paymentMethod) ? data.paymentMethod : "pix",
      items: data.items.slice(0, 40).map((line) => ({
        product_id: String(line.product_id),
        quantity: Math.max(1, Math.min(99, Number(line.quantity) || 1)),
      })),
    };
  })
  .handler(async ({ data }): Promise<{ code: string; total_cents: number }> => {
    const { publicDb } = await import("./public-db.server");
    const { data: result, error } = await publicDb().rpc("create_order", {
      p_menu_code: data.menuCode,
      p_items: data.items,
      p_payment_method: data.paymentMethod,
    });
    if (error) throw new Error(error.message);
    return result as { code: string; total_cents: number };
  });

export const confirmPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => ({ code: String(data.code).slice(0, 32) }))
  .handler(async ({ data }): Promise<VoucherPayload | null> => {
    const { publicDb } = await import("./public-db.server");
    const db = publicDb();
    const { error } = await db.rpc("confirm_payment", { p_order_code: data.code });
    if (error) throw new Error(error.message);
    const { data: voucher } = await db.rpc("get_voucher", { p_code: data.code });
    return (voucher as VoucherPayload | null) ?? null;
  });

export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { pin: string }) => ({ pin: String(data.pin).slice(0, 12) }))
  .handler(async ({ data }): Promise<StaffSession | null> => {
    const { publicDb } = await import("./public-db.server");
    const { data: result, error } = await publicDb().rpc("staff_login", { p_pin: data.pin });
    if (error) throw new Error(error.message);
    return (result as StaffSession | null) ?? null;
  });

export const staffGetOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { pin: string; code: string }) => ({
    pin: String(data.pin).slice(0, 12),
    code: String(data.code).slice(0, 32),
  }))
  .handler(async ({ data }): Promise<{ voucher: VoucherPayload | null; error: string | null }> => {
    const { publicDb } = await import("./public-db.server");
    const { data: result, error } = await publicDb().rpc("staff_get_order", {
      p_pin: data.pin,
      p_order_code: data.code,
    });
    if (error) return { voucher: null, error: error.message };
    return { voucher: (result as VoucherPayload | null) ?? null, error: null };
  });


export const registerPickup = createServerFn({ method: "POST" })
  .inputValidator((data: { pin: string; code: string; items: { item_id: string; quantity: number }[] }) => ({
    pin: String(data.pin).slice(0, 12),
    code: String(data.code).slice(0, 32),
    items: (data.items ?? []).slice(0, 40).map((entry) => ({
      item_id: String(entry.item_id),
      quantity: Math.max(0, Math.min(999, Number(entry.quantity) || 0)),
    })),
  }))
  .handler(async ({ data }): Promise<VoucherPayload | null> => {
    const { publicDb } = await import("./public-db.server");
    const { data: result, error } = await publicDb().rpc("register_pickup", {
      p_pin: data.pin,
      p_order_code: data.code,
      p_items: data.items,
    });
    if (error) throw new Error(error.message);
    return (result as VoucherPayload | null) ?? null;
  });

export const staffSetStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { pin: string; code: string; status: string }) => ({
    pin: String(data.pin).slice(0, 12),
    code: String(data.code).slice(0, 32),
    status: String(data.status),
  }))
  .handler(async ({ data }): Promise<VoucherPayload | null> => {
    const { publicDb } = await import("./public-db.server");
    const { data: result, error } = await publicDb().rpc("staff_set_status", {
      p_pin: data.pin,
      p_order_code: data.code,
      p_status: data.status,
    });
    if (error) throw new Error(error.message);
    return (result as VoucherPayload | null) ?? null;
  });

/** Marca um item específico como pronto/entregue usando o PIN do balcão. */
export const staffSetItemStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { pin: string; code: string; itemId: string; status?: string }) => ({
    pin: String(data.pin).slice(0, 12),
    code: String(data.code).slice(0, 32),
    itemId: String(data.itemId),
    status: ["recebido", "preparando", "pronto", "entregue"].includes(String(data.status)) ? String(data.status) : "pronto",
  }))
  .handler(async ({ data }): Promise<{ error: string | null }> => {
    const { publicDb } = await import("./public-db.server");
    const { error } = await publicDb().rpc("staff_set_status", {
      p_pin: data.pin,
      p_order_code: data.code,
      p_status: data.status,
      p_item_id: data.itemId,
    });
    return { error: error ? error.message : null };
  });

/** Lista os pedidos pagos com itens pendentes do balcão vinculado ao PIN. */
export const staffListOpenOrders = createServerFn({ method: "POST" })
  .inputValidator((data: { pin: string }) => ({ pin: String(data.pin).slice(0, 12) }))
  .handler(async ({ data }): Promise<OpenOrder[]> => {
    const { publicDb } = await import("./public-db.server");
    const { data: result, error } = await publicDb().rpc("staff_open_orders", { p_pin: data.pin });
    if (error) throw new Error(error.message);
    return (result as OpenOrder[] | null) ?? [];
  });
