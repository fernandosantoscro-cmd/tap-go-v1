import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type ScanFeedback = { kind: "success" | "error"; title: string; detail?: string } | null;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Bip curto + vibração para confirmar a leitura sem o operador olhar a tela. */
export function playScanCue(kind: "success" | "error") {
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = kind === "success" ? 880 : 220;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (kind === "success" ? 0.14 : 0.28));
      setTimeout(() => void ctx.close(), 600);
    }
  } catch {
    /* áudio bloqueado pelo navegador */
  }
  try {
    navigator.vibrate?.(kind === "success" ? 60 : [40, 60, 40]);
  } catch {
    /* sem vibração */
  }
}

interface ScanFeedbackOverlayProps {
  feedback: ScanFeedback;
  onDone: () => void;
  duration?: number;
}

/** Overlay animado de sucesso/erro exibido após uma leitura ou retirada. */
export function ScanFeedbackOverlay({ feedback, onDone, duration = 1600 }: ScanFeedbackOverlayProps) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => setReduced(prefersReducedMotion()), []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [feedback, duration, onDone]);

  if (!feedback) return null;
  const success = feedback.kind === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95 px-8 text-center backdrop-blur",
        !reduced && "animate-fade-in",
      )}
    >
      <div
        className={cn(
          "flex size-28 items-center justify-center rounded-full",
          success ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          !reduced && "animate-scale-in",
        )}
      >
        {success ? <CheckCircle2 className="size-16" aria-hidden /> : <XCircle className="size-16" aria-hidden />}
      </div>
      <p className="text-2xl font-semibold">{feedback.title}</p>
      {feedback.detail && <p className="max-w-sm text-sm text-muted-foreground">{feedback.detail}</p>}
    </div>
  );
}
