import QRCode from "qrcode";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  title?: string;
}

/** Renderiza um QR Code real em canvas (escaneável por qualquer câmera). */
export function QrCode({ value, size = 240, className, title }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    void QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#141414", light: "#ffffff" },
    });
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      role="img"
      aria-label={title ?? `QR Code ${value}`}
      className={cn("rounded-xl bg-background", className)}
    />
  );
}

export async function qrCodeDataUrl(value: string, size = 640): Promise<string> {
  return QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: "M" });
}
