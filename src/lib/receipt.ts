import type { VoucherPayload } from "./tapgo-types";
import { formatBRL } from "./format";

const PAY_LABEL: Record<string, string> = { pix: "PIX", card: "Cartão de crédito", cash: "Dinheiro" };

/** Desenha o recibo da compra em um canvas e devolve o PNG. */
export async function buildReceiptBlob(voucher: VoucherPayload): Promise<Blob> {
  const scale = 2;
  const width = 720;
  const lineHeight = 34;
  const headerHeight = 260;
  const footerHeight = 210;
  const height = headerHeight + voucher.items.length * lineHeight + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar o recibo");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#111111";

  const left = 48;
  let y = 64;

  ctx.font = "700 34px Helvetica, Arial, sans-serif";
  ctx.fillText("TapGo", left, y);
  ctx.fillStyle = "#8a8a8a";
  ctx.font = "400 16px Helvetica, Arial, sans-serif";
  ctx.fillText("Recibo de compra", left + 110, y);

  y += 44;
  ctx.fillStyle = "#111111";
  ctx.font = "600 24px Helvetica, Arial, sans-serif";
  ctx.fillText(voucher.establishment?.name ?? "Estabelecimento", left, y);

  y += 28;
  ctx.fillStyle = "#6b6b6b";
  ctx.font = "400 16px Helvetica, Arial, sans-serif";
  const eventLine = [voucher.event?.name, voucher.event?.location, voucher.menu?.name]
    .filter(Boolean)
    .join(" · ");
  if (eventLine) ctx.fillText(eventLine, left, y);

  y += 30;
  ctx.fillText(`Pedido ${voucher.order.code.toUpperCase()}`, left, y);
  y += 24;
  ctx.fillText(
    `${new Date(voucher.order.paid_at ?? voucher.order.created_at).toLocaleString("pt-BR")} · ${
      PAY_LABEL[voucher.order.payment_method ?? ""] ?? "Pagamento"
    }`,
    left,
    y,
  );
  if (voucher.order.payment_reference) {
    y += 24;
    ctx.fillText(`Ref.: ${voucher.order.payment_reference}`, left, y);
  }

  y += 34;
  ctx.strokeStyle = "#e4e4e4";
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(width - left, y);
  ctx.stroke();

  y += 34;
  ctx.fillStyle = "#111111";
  ctx.font = "400 18px Helvetica, Arial, sans-serif";
  for (const item of voucher.items) {
    const label = `${item.quantity}× ${item.name}`;
    ctx.fillText(label.length > 44 ? `${label.slice(0, 43)}…` : label, left, y);
    const value = formatBRL(item.unit_price_cents * item.quantity);
    const metrics = ctx.measureText(value);
    ctx.fillText(value, width - left - metrics.width, y);
    y += lineHeight;
  }

  y += 6;
  ctx.strokeStyle = "#e4e4e4";
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(width - left, y);
  ctx.stroke();

  y += 44;
  ctx.font = "700 26px Helvetica, Arial, sans-serif";
  ctx.fillText("Total", left, y);
  const total = formatBRL(voucher.order.total_cents);
  const totalMetrics = ctx.measureText(total);
  ctx.fillText(total, width - left - totalMetrics.width, y);

  y += 48;
  ctx.fillStyle = "#8a8a8a";
  ctx.font = "400 14px Helvetica, Arial, sans-serif";
  ctx.fillText("Documento não fiscal · válido como comprovante de compra.", left, y);
  y += 22;
  ctx.fillText("Emitido pelo TapGo — pedido e retirada por QR Code.", left, y);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem"))), "image/png");
  });
}

export async function downloadReceipt(voucher: VoucherPayload): Promise<void> {
  const blob = await buildReceiptBlob(voucher);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `recibo-${voucher.order.code}.png`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Compartilha o recibo (WhatsApp, e-mail, etc.) com fallback de cópia do link. */
export async function shareReceipt(voucher: VoucherPayload): Promise<"shared" | "copied" | "downloaded"> {
  const text = `Recibo do pedido ${voucher.order.code.toUpperCase()} — ${
    voucher.establishment?.name ?? "TapGo"
  } · ${formatBRL(voucher.order.total_cents)}`;
  const link = `${window.location.origin}/voucher/${voucher.order.code}`;

  const blob = await buildReceiptBlob(voucher);
  const file = new File([blob], `recibo-${voucher.order.code}.png`, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: "Recibo TapGo", text });
    return "shared";
  }
  if (nav.share) {
    await nav.share({ title: "Recibo TapGo", text, url: link });
    return "shared";
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${link}`);
    return "copied";
  } catch {
    await downloadReceipt(voucher);
    return "downloaded";
  }
}
