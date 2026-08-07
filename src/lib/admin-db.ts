import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/** Garante que o usuário logado tenha um estabelecimento (cria no primeiro acesso). */
export function useEstablishment() {
  return useQuery({
    queryKey: ["establishment"],
    staleTime: 60_000,
    queryFn: async (): Promise<Establishment> => {
      const result = await supabase.rpc("ensure_my_establishment", {});
      return unwrap(result) as unknown as Establishment;
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

export function useOrders(establishmentId?: string) {
  return useQuery({
    queryKey: ["orders", establishmentId],
    enabled: Boolean(establishmentId),
    refetchInterval: 15_000,
    queryFn: async (): Promise<AdminOrder[]> =>
      unwrap(
        await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("establishment_id", establishmentId!)
          .order("created_at", { ascending: false })
          .limit(200),
      ) as AdminOrder[],
  });
}

export function usePickups(establishmentId?: string) {
  return useQuery({
    queryKey: ["pickups", establishmentId],
    enabled: Boolean(establishmentId),
    queryFn: async (): Promise<PickupRow[]> =>
      unwrap(
        await supabase
          .from("pickups")
          .select("*")
          .eq("establishment_id", establishmentId!)
          .order("created_at", { ascending: false })
          .limit(300),
      ),
  });
}

export function useLogs(establishmentId?: string) {
  return useQuery({
    queryKey: ["logs", establishmentId],
    enabled: Boolean(establishmentId),
    queryFn: async (): Promise<LogRow[]> =>
      unwrap(
        await supabase
          .from("logs")
          .select("*")
          .eq("establishment_id", establishmentId!)
          .order("created_at", { ascending: false })
          .limit(80),
      ),
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
