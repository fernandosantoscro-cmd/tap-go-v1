import type { VoucherItem, VoucherPayload } from "./tapgo-types";

/** Item liberado para entrega imediata (bebida/sem preparo, ou comida já pronta). */
export function isReadyForPickup(item: VoucherItem): boolean {
  if (!item.requires_prep) return true;
  return item.status === "pronto" || item.status === "entregue";
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
  if (!item.requires_prep || isReadyForPickup(item)) return null;
  if (!paidAt) return item.prep_minutes;
  const elapsed = (Date.now() - new Date(paidAt).getTime()) / 60000;
  return Math.max(0, Math.ceil(item.prep_minutes - elapsed));
}

export function kitchenItemLabel(item: VoucherItem, paidAt: string | null): string {
  if (item.available_quantity === 0) return "Retirado";
  if (isReadyForPickup(item)) return "Pronto para retirar";
  const left = minutesRemaining(item, paidAt);
  return left && left > 0 ? `Em preparo · ~${left} min` : "Em preparo · finalizando";
}
