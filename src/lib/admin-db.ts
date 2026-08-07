import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DateRange } from "@/lib/date-range";
import type { OpenState } from "@/lib/tapgo-types";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export type Establishment = Row<"establishments">;
export type EventRow = Row<"events">;
export type MenuRow = Row<"menus">;
export type CategoryRow = Row<"categories">;
export type ProductRow = Row<"products">;
export type OrderRow = Row<"orders">;
export type OrderItemRow = Row<"order_items">;
export type StaffRow = Row<"staff">;
export type PaymentMethodRow = Row<"payment_methods">;
export type PickupRow = Row<"pickups">;
export type LogRow = Row<"logs">;

export const SIGNUP_KEY = "tapgo.signup";

export interface PendingSignup {
  name?: string;
  type?: string;
  phone?: string;
  document?: string;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

function readPendingSignup(): PendingSignup | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SIGNUP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingSignup;
  } catch {
    return null;
  }
}

/** Garante que o usuário logado tenha um estabelecimento (cria no primeiro acesso). */
export function useEstablishment() {
  return useQuery({
    queryKey: ["establishment"],
    staleTime: 60_000,
    queryFn: async (): Promise<Establishment> => {
      const pending = readPendingSignup();
      const args: { p_name?: string; p_document?: string; p_type?: string; p_phone?: string } = {};
      if (pending?.name) args.p_name = pending.name;
      if (pending?.document) args.p_document = pending.document;
      if (pending?.type) args.p_type = pending.type;
      if (pending?.phone) args.p_phone = pending.phone;
      const result = await supabase.rpc("ensure_my_establishment", args);

      if (!result.error && typeof window !== "undefined") localStorage.removeItem(SIGNUP_KEY);
      return unwrap(result) as unknown as Establishment;
    },
  });
}

/** Estado "aberto agora" calculado no banco (respeita fuso e horários). */
export function useOpenState(establishmentId?: string) {
  return useQuery({
    queryKey: ["open_state", establishmentId],
    enabled: Boolean(establishmentId),
    refetchInterval: 60_000,
    queryFn: async (): Promise<OpenState> =>
      unwrap(await supabase.rpc("establishment_open_state", { p_id: establishmentId! })) as unknown as OpenState,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: { id: string } & Database["public"]["Tables"]["establishments"]["Update"]) => {
      const { id, ...patch } = values;
      return unwrap(await supabase.from("establishments").update(patch).eq("id", id).select().single());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["establishment"] });
      void queryClient.invalidateQueries({ queryKey: ["open_state"] });
    },
  });
}

export function useRegenerateMenuCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (menuId: string) =>
      unwrap(await supabase.rpc("regenerate_menu_code", { p_menu_id: menuId })) as unknown as { code: string },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["menus"] });
      void queryClient.invalidateQueries({ queryKey: ["menu"] });
    },
  });
}


export function useUpdateEstablishment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: { id: string; name: string; document?: string | null; logo_url?: string | null }) =>
      unwrap(
        await supabase
          .from("establishments")
          .update({ name: values.name, document: values.document ?? null, logo_url: values.logo_url ?? null })
          .eq("id", values.id)
          .select()
          .single(),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["establishment"] }),
  });
}

export function useEvents(establishmentId?: string) {
  return useQuery({
    queryKey: ["events", establishmentId],
    enabled: Boolean(establishmentId),
    queryFn: async (): Promise<EventRow[]> =>
      unwrap(
        await supabase
          .from("events")
          .select("*")
          .eq("establishment_id", establishmentId!)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useMenus(establishmentId?: string) {
  return useQuery({
    queryKey: ["menus", establishmentId],
    enabled: Boolean(establishmentId),
    queryFn: async (): Promise<MenuRow[]> =>
      unwrap(
        await supabase
          .from("menus")
          .select("*")
          .eq("establishment_id", establishmentId!)
          .order("sort_order")
          .order("created_at"),
      ),
  });
}

export function useMenu(menuId: string) {
  return useQuery({
    queryKey: ["menu", menuId],
    queryFn: async (): Promise<MenuRow> =>
      unwrap(await supabase.from("menus").select("*").eq("id", menuId).single()),
  });
}

export function useCategories(menuId?: string) {
  return useQuery({
    queryKey: ["categories", menuId],
    enabled: Boolean(menuId),
    queryFn: async (): Promise<CategoryRow[]> =>
      unwrap(await supabase.from("categories").select("*").eq("menu_id", menuId!).order("sort_order").order("name")),
  });
}

export function useProducts(menuId?: string) {
  return useQuery({
    queryKey: ["products", menuId],
    enabled: Boolean(menuId),
    queryFn: async (): Promise<ProductRow[]> =>
      unwrap(await supabase.from("products").select("*").eq("menu_id", menuId!).order("sort_order").order("name")),
  });
}

export function useStaff(establishmentId?: string) {
  return useQuery({
    queryKey: ["staff", establishmentId],
    enabled: Boolean(establishmentId),
    queryFn: async (): Promise<StaffRow[]> =>
      unwrap(await supabase.from("staff").select("*").eq("establishment_id", establishmentId!).order("created_at")),
  });
}

export function usePaymentMethods(establishmentId?: string) {
  return useQuery({
    queryKey: ["payment_methods", establishmentId],
    enabled: Boolean(establishmentId),
    queryFn: async (): Promise<PaymentMethodRow[]> =>
      unwrap(
        await supabase.from("payment_methods").select("*").eq("establishment_id", establishmentId!).order("sort_order"),
      ),
  });
}

export interface AdminOrder extends OrderRow {
  order_items: OrderItemRow[];
}

export function useOrders(establishmentId?: string, range?: DateRange) {
  return useQuery({
    queryKey: ["orders", establishmentId, range?.from ?? null, range?.to ?? null],
    enabled: Boolean(establishmentId),
    refetchInterval: 15_000,
    queryFn: async (): Promise<AdminOrder[]> => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("establishment_id", establishmentId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (range?.from) query = query.gte("created_at", range.from);
      if (range?.to) query = query.lt("created_at", range.to);
      return unwrap(await query) as AdminOrder[];
    },
  });
}

export function usePickups(establishmentId?: string, range?: DateRange) {
  return useQuery({
    queryKey: ["pickups", establishmentId, range?.from ?? null, range?.to ?? null],
    enabled: Boolean(establishmentId),
    queryFn: async (): Promise<PickupRow[]> => {
      let query = supabase
        .from("pickups")
        .select("*")
        .eq("establishment_id", establishmentId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (range?.from) query = query.gte("created_at", range.from);
      if (range?.to) query = query.lt("created_at", range.to);
      return unwrap(await query);
    },
  });
}

export function useLogs(establishmentId?: string, range?: DateRange) {
  return useQuery({
    queryKey: ["logs", establishmentId, range?.from ?? null, range?.to ?? null],
    enabled: Boolean(establishmentId),
    queryFn: async (): Promise<LogRow[]> => {
      let query = supabase
        .from("logs")
        .select("*")
        .eq("establishment_id", establishmentId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (range?.from) query = query.gte("created_at", range.from);
      if (range?.to) query = query.lt("created_at", range.to);
      return unwrap(await query);
    },
  });
}


export function useSetOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: { orderId: string; status: string; itemId?: string }) =>
      unwrap(
        await supabase.rpc(
          "owner_set_order_status",
          values.itemId
            ? { p_order_id: values.orderId, p_status: values.status, p_item_id: values.itemId }
            : { p_order_id: values.orderId, p_status: values.status },
        ),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["logs"] });
    },
  });
}

/** Mutação genérica de tabela com invalidação da chave informada. */
export function useTableMutation<K extends "events" | "menus" | "categories" | "products" | "staff" | "payment_methods">(
  table: K,
  invalidate: unknown[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      action:
        | { type: "insert"; values: Database["public"]["Tables"][K]["Insert"] }
        | { type: "update"; id: string; values: Database["public"]["Tables"][K]["Update"] }
        | { type: "delete"; id: string },
    ) => {
      if (action.type === "insert") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return unwrap(await (supabase.from(table) as any).insert(action.values).select().single());
      }
      if (action.type === "update") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return unwrap(await (supabase.from(table) as any).update(action.values).eq("id", action.id).select().single());
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(table) as any).delete().eq("id", action.id);
      if (error) throw new Error(error.message);
      return null;
    },
    onSuccess: () => {
      for (const key of invalidate) void queryClient.invalidateQueries({ queryKey: [key] });
    },
  });
}
