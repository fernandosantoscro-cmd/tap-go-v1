import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type Ping = { item_name: string | null; status: string };

const LABEL: Record<string, string> = {
  preparando: "entrou em preparo",
  pronto: "está pronto para retirada",
  entregue: "foi retirado",
};

/**
 * Escuta em tempo real as mudanças de status dos itens do pedido e avisa o
 * cliente com notificação do sistema + vibração, sem depender do polling.
 */
export function useOrderRealtime(code: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  const enableAlerts = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    if (!code) return;
    const channel = supabase
      .channel(`order-pings-${code.toLowerCase()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_pings",
          filter: `order_code=eq.${code.toLowerCase()}`,
        },
        (payload) => {
          const ping = payload.new as Ping;
          onChangeRef.current();

          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.(ping.status === "pronto" ? [120, 60, 120] : 80);
          }

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const what = ping.item_name ?? "Seu item";
            const how = LABEL[ping.status] ?? "mudou de status";
            new Notification(ping.status === "pronto" ? "Pronto para retirar 🎉" : "Atualização do pedido", {
              body: `${what} ${how}.`,
              tag: `order-${code}-${ping.status}`,
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [code]);

  return { permission, enableAlerts };
}
