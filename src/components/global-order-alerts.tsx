import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, PartyPopper, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMyOrders } from "@/lib/my-orders";
import { publishOrderAlert, subscribeOrderAlerts, type OrderAlert } from "@/lib/order-alert-bus";

type Ping = { id: string; item_name: string | null; status: string; quantity?: number | null; created_at: string };

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 10000;

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
 * Aviso de "pronto para retirada" em qualquer tela do PWA: pop-up discreto no
 * rodapé (canto direito no desktop), com vibração, som e notificação do
 * sistema. É a única superfície de alerta — nada de overlay em tela cheia.
 */
export function GlobalOrderAlerts() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [alerts, setAlerts] = useState<OrderAlert[]>([]);

  const dismiss = useCallback((id: string) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }, []);

  const push = useCallback((alert: OrderAlert) => {
    setAlerts((current) => [...current.filter((item) => item.id !== alert.id), alert].slice(-MAX_VISIBLE));
    setTimeout(() => setAlerts((current) => current.filter((item) => item.id !== alert.id)), AUTO_DISMISS_MS);
  }, []);

  // Avisos publicados por outras telas (ex.: a própria tela do voucher).
  useEffect(() => subscribeOrderAlerts(push) as unknown as () => void, [push]);

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

        // A tela do próprio pedido publica o aviso pelo canal (com rolagem até o QR).
        if (pathname.toLowerCase().includes(code)) continue;

        const ready = pings.filter((ping) => ping.status === "pronto");
        const last = ready[ready.length - 1];
        if (!last) continue;
        buzz();
        publishOrderAlert({
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

  if (alerts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          role="alertdialog"
          aria-live="assertive"
          className="pointer-events-auto rounded-3xl border bg-card/95 p-4 shadow-soft backdrop-blur animate-enter"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
              <PartyPopper className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Pronto para retirada</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {alert.quantity}× {alert.itemName} · pedido {alert.code.toUpperCase()}
              </p>
              {alert.sameScreen ? (
                <Button
                  size="sm"
                  className="mt-3 rounded-full"
                  onClick={() => {
                    dismiss(alert.id);
                    document.getElementById("voucher-qr")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <Bell className="mr-2 size-4" aria-hidden /> Ver QR de retirada
                </Button>
              ) : (
                <Button asChild size="sm" className="mt-3 rounded-full">
                  <Link to="/voucher/$code" params={{ code: alert.code }} onClick={() => dismiss(alert.id)}>
                    <Bell className="mr-2 size-4" aria-hidden /> Ver pedido
                  </Link>
                </Button>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full"
              aria-label="Fechar aviso"
              onClick={() => dismiss(alert.id)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
