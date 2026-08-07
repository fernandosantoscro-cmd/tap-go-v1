import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  title?: string;
}

/** Renderiza um QR Code real (escaneável por qualquer câmera). */
export function QrCode({ value, size = 240, className, title }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#141414ff", light: "#ffffffff" },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn("animate-pulse rounded-xl bg-secondary", className)}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={title ?? `QR Code ${value}`}
      className={cn("rounded-xl bg-white", className)}
    />
  );
}
