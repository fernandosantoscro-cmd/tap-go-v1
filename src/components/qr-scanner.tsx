import { Camera, CameraOff, RefreshCcw } from "lucide-react";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QrScannerProps {
  onDetected: (value: string) => void;
  paused?: boolean;
  className?: string;
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

/**
 * Leitor de QR Code por câmera (webcam do computador ou câmera do tablet).
 * Usa BarcodeDetector nativo quando disponível e cai para jsQR em canvas.
 */
export function QrScanner({ onDetected, paused = false, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastValueRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });
  const pausedRef = useRef(paused);
  // Mantém o callback em ref: assim a câmera não reinicia a cada render do pai.
  const onDetectedRef = useRef(onDetected);


  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [status, setStatus] = useState<"idle" | "starting" | "live" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);


  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setStatus("starting");
    setErrorMessage(null);
    stop();

    try {
      const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const cams = all.filter((device) => device.kind === "videoinput");
      const target = cams[deviceIndex];

      const stream = await navigator.mediaDevices.getUserMedia({
        video: target?.deviceId
          ? { deviceId: { exact: target.deviceId } }
          : { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const refreshed = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setDevices(refreshed.filter((device) => device.kind === "videoinput"));
      setStatus("live");

      const globalWithDetector = window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
      };
      if (globalWithDetector.BarcodeDetector && !detectorRef.current) {
        try {
          detectorRef.current = new globalWithDetector.BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          detectorRef.current = null;
        }
      }

      const emit = (raw: string) => {
        const now = Date.now();
        if (lastValueRef.current.value === raw && now - lastValueRef.current.at < 2500) return;
        lastValueRef.current = { value: raw, at: now };
        onDetectedRef.current(raw);
      };

      const tick = async () => {
        rafRef.current = requestAnimationFrame(() => void tick());
        if (pausedRef.current || video.readyState < 2) return;

        if (detectorRef.current) {
          try {
            const found = await detectorRef.current.detect(video);
            if (found[0]?.rawValue) emit(found[0].rawValue);
            return;
          } catch {
            detectorRef.current = null;
          }
        }

        if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
        const canvas = canvasRef.current;
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) return;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(video, 0, 0, width, height);
        const image = context.getImageData(0, 0, width, height);
        const result = jsQR(image.data, width, height, { inversionAttempts: "dontInvert" });
        if (result?.data) emit(result.data);
      };

      void tick();
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Permissão de câmera negada. Libere o acesso no navegador e tente novamente."
          : "Não foi possível acessar a câmera. Use a digitação manual do código.",
      );
    }
  }, [deviceIndex, stop]);

  useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border bg-ink">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          aria-label="Pré-visualização da câmera"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "size-52 rounded-2xl border-4 transition-colors",
              paused ? "border-success" : "border-primary",
            )}
          />
        </div>
        {status !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-ink-foreground">
            {status === "error" ? <CameraOff className="size-8" /> : <Camera className="size-8 animate-pulse" />}
            <p className="text-sm">
              {status === "error" ? errorMessage : "Abrindo a câmera…"}
            </p>
            {status === "error" && (
              <Button variant="secondary" onClick={() => void start()}>
                Tentar novamente
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {status === "live" ? "Aponte o QR Code do voucher para a câmera." : "Câmera indisponível."}
        </p>
        {devices.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeviceIndex((index) => (index + 1) % devices.length)}
          >
            <RefreshCcw className="mr-2 size-4" />
            Trocar câmera
          </Button>
        )}
      </div>
    </div>
  );
}

/** Aceita tanto o código puro quanto a URL completa do voucher. */
export function extractOrderCode(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/voucher\/([a-zA-Z0-9-]+)/);
  if (match?.[1]) return match[1];
  try {
    const url = new URL(trimmed);
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (last) return last;
  } catch {
    /* não é URL */
  }
  return trimmed;
}
