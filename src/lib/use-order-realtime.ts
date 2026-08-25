import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type Ping = { id: string; item_name: string | null; status: string; created_at: string };

export type ReadyAlert = { id: string; itemName: string; at: number };

const LABEL: Record<string, string> = {
  preparando: "entrou em preparo",
  pronto: "está pronto para retirada",
  entregue: "foi retirado",
};

/** Bip curto de alerta — som ajuda quando o celular está no bolso sem vibração. */
function playAlertTone() {
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [880, 1180].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + index * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + index * 0.18);
      osc.stop(now + index * 0.18 + 0.18);
    });
    setTimeout(() => void ctx.close(), 900);
  } catch {
    /* áudio bloqueado pelo navegador */
  }
}

/**
 * Acompanha as mudanças de status dos itens do pedido consultando a função
 * segura `get_order_pings`, que só devolve avisos de quem já conhece o código
 * exato do pedido, e avisa o cliente com notificação do sistema, som,
 * vibração, título piscando e um alerta visual na tela.
 */
export function useOrderRealtime(code: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [readyAlert, setReadyAlert] = useState<ReadyAlert | null>(null);
  const pendingReady = useRef(0);
  const baseTitle = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  const enableAlerts = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    // Desbloqueia o áudio no mesmo gesto do usuário (exigência de iOS/Safari).
    playAlertTone();
  }, []);

  const dismissReady = useCallback(() => setReadyAlert(null), []);

  /** Limpa o contador do título quando o cliente volta para a aba. */
  const clearTitleBadge = useCallback(() => {
    pendingReady.current = 0;
    if (typeof document !== "undefined" && baseTitle.current) document.title = baseTitle.current;
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    baseTitle.current = document.title;
    const onVisible = () => {
      if (document.visibilityState === "visible") clearTitleBadge();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (baseTitle.current) document.title = baseTitle.current;
    };
  }, [clearTitleBadge]);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let since = new Date().toISOString();

    const notify = (ping: Ping) => {
      onChangeRef.current();
      const ready = ping.status === "pronto";
      const what = ping.item_name ?? "Seu item";

      try {
        navigator.vibrate?.(ready ? [200, 100, 200, 100, 320] : 80);
      } catch {
        /* sem vibração */
      }

      if (ready) {
        playAlertTone();
        setReadyAlert({ id: ping.id, itemName: what, at: Date.now() });
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          pendingReady.current += 1;
          if (!baseTitle.current) baseTitle.current = document.title;
          document.title = `(${pendingReady.current}) Pronto para retirar!`;
        }
      }

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const how = LABEL[ping.status] ?? "mudou de status";
        new Notification(ready ? "Pronto para retirar 🎉" : "Atualização do pedido", {
          body: `${what} ${how}.`,
          tag: `order-${code}-${ping.id}`,
          ...(ready ? { vibrate: [200, 100, 200] } : {}),
        } as NotificationOptions);
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

    void poll();
    const timer = setInterval(() => void poll(), 2000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [code]);

  return { permission, enableAlerts, readyAlert, dismissReady };
}
