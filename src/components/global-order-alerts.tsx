import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, PartyPopper, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMyOrders } from "@/lib/my-orders";

type Ping = { id: string; item_name: string | null; status: string; quantity?: number | null; created_at: string };

interface Alert {
  id: string;
  code: string;
  itemName: string;
  quantity: number;
}

/** Vibração + bip curto: o cliente pode estar com o celular no bolso. */
function buzz() {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 320]);
  } catch {
    /* sem vibração */
  }
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 980;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
    setTimeout(() => void ctx.close(), 700);
  } catch {
    /* áudio bloqueado */
  }
}

/**
 * Aviso de "pronto para retirada" em qualquer tela do PWA: acompanha todos os
 * pedidos guardados neste aparelho e mostra um modal pequeno com vibração,
 * som e notificação do sistema quando o balcão libera unidades.
 */
export function GlobalOrderAlerts() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    let cancelled = false;
    const since: Record<string, string> = {};

    const poll = async () => {
      const codes = listMyOrders()
        .slice(0, 6)
        .map((order) => order.code.toLowerCase());
      for (const code of codes) {
        since[code] ??= new Date().toISOString();
        const { data, error } = await supabase.rpc("get_order_pings", {
          p_code: code,
          p_since: since[code]!,
        });
        if (cancelled || error) continue;
        const pings = (data ?? []) as unknown as Ping[];
        if (pings.length === 0) continue;
        since[code] = pings[pings.length - 1]!.created_at;

        // Na tela do próprio pedido o aviso em tela cheia já aparece.
        if (pathname.toLowerCase().includes(code)) continue;

        const ready = pings.filter((ping) => ping.status === "pronto");
        const last = ready[ready.length - 1];
        if (!last) continue;
        buzz();
        setAlert({
          id: last.id,
          code,
          itemName: last.item_name ?? "Seu item",
          quantity: Number(last.quantity ?? 1) || 1,
        });
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification("Pronto para retirar 🎉", {
            body: `${last.quantity ?? 1}× ${last.item_name ?? "seu item"} disponível para retirada.`,
            tag: `order-${code}-${last.id}`,
          });
        }
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  if (!alert) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-x-3 bottom-3 z-[60] rounded-2xl border border-primary/50 bg-background p-4 shadow-lg animate-fade-in sm:left-auto sm:right-4 sm:w-96"
    >
      <div className="flex items-start gap-3">
        <PartyPopper className="mt-0.5 size-5 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Seu pedido está pronto</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {alert.quantity}× {alert.itemName} disponível para retirada · pedido {alert.code.toUpperCase()}
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/voucher/$code" params={{ code: alert.code }} onClick={() => setAlert(null)}>
              <Bell className="mr-2 size-4" aria-hidden /> Ver pedido
            </Link>
          </Button>
        </div>
        <Button size="icon" variant="ghost" aria-label="Fechar aviso" onClick={() => setAlert(null)}>
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
