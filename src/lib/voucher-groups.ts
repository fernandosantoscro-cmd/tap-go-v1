import type { VoucherItem, VoucherPayload } from "./tapgo-types";

/** Há unidades liberadas pelo balcão aguardando retirada. */
export function isReadyForPickup(item: VoucherItem): boolean {
  return item.available_quantity > 0;
}

/** Ainda existe alguma unidade em preparo. */
export function isPreparing(item: VoucherItem): boolean {
  return item.preparing_quantity > 0;
}

/** Separa o voucher em balcão (imediato) e cozinha (com preparo). */
export function splitVoucherItems(voucher: VoucherPayload) {
  const counter: VoucherItem[] = [];
  const kitchen: VoucherItem[] = [];
  for (const item of voucher.items) {
    if (item.requires_prep) kitchen.push(item);
    else counter.push(item);
  }
  return { counter, kitchen };
}

/** Minutos restantes estimados de preparo, contados do pagamento. */
export function minutesRemaining(item: VoucherItem, paidAt: string | null): number | null {
  if (!item.requires_prep || item.preparing_quantity === 0) return null;
  if (!paidAt) return item.prep_minutes;
  const elapsed = (Date.now() - new Date(paidAt).getTime()) / 60000;
  return Math.max(0, Math.ceil(item.prep_minutes - elapsed));
}

/** Resumo em linguagem simples das quantidades do item. */
export function quantityLabel(item: VoucherItem): string {
  if (item.remaining_quantity === 0) return `${item.quantity} retirado${item.quantity > 1 ? "s" : ""}`;
  const parts: string[] = [];
  if (item.available_quantity > 0) parts.push(`${item.available_quantity} pronta(s) para retirada`);
  if (item.preparing_quantity > 0) parts.push(`${item.preparing_quantity} em preparo`);
  if (item.delivered_quantity > 0) parts.push(`${item.delivered_quantity} já retirada(s)`);
  return parts.join(" · ");
}

export function kitchenItemLabel(item: VoucherItem, paidAt: string | null): string {
  if (item.remaining_quantity === 0) return "Retirado";
  if (item.preparing_quantity === 0) return "Pronto para retirar";
  const left = minutesRemaining(item, paidAt);
  const prefix = item.available_quantity > 0 ? `${item.available_quantity} pronta(s) · ` : "";
  return left && left > 0 ? `${prefix}${item.preparing_quantity} em preparo · ~${left} min` : `${prefix}${item.preparing_quantity} em preparo`;
}
