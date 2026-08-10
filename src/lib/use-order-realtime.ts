import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type Ping = { id: string; item_name: string | null; status: string; created_at: string };

const LABEL: Record<string, string> = {
  preparando: "entrou em preparo",
  pronto: "está pronto para retirada",
  entregue: "foi retirado",
};

/**
 * Acompanha as mudanças de status dos itens do pedido consultando a função
 * segura `get_order_pings`, que só devolve avisos de quem já conhece o código
 * exato do pedido, e avisa o cliente com notificação do sistema + vibração.
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
    let cancelled = false;
    let since = new Date().toISOString();

    const notify = (ping: Ping) => {
      onChangeRef.current();

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(ping.status === "pronto" ? [120, 60, 120] : 80);
      }

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const what = ping.item_name ?? "Seu item";
        const how = LABEL[ping.status] ?? "mudou de status";
        new Notification(ping.status === "pronto" ? "Pronto para retirar 🎉" : "Atualização do pedido", {
          body: `${what} ${how}.`,
          tag: `order-${code}-${ping.status}`,
        });
      }
    };

    const poll = async () => {
      const { data, error } = await supabase.rpc("get_order_pings", {
        p_code: code.toLowerCase(),
        p_since: since,
      });
      if (cancelled || error) return;

      const pings = (data ?? []) as unknown as Ping[];
      if (pings.length === 0) return;

      since = pings[pings.length - 1]!.created_at;
      for (const ping of pings) notify(ping);
    };

    const timer = setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [code]);

  return { permission, enableAlerts };
}
