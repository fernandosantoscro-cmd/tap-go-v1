/**
 * Guarda os pedidos feitos neste aparelho para a aba "Meus pedidos".
 * Nada sensível: apenas o código público do pedido e uma referência visual.
 */

const KEY = "tapgo.my-orders";
const MENU_KEY = "tapgo.last-menu";

/** Guarda o último cardápio aberto neste aparelho (aba "Cardápio"). */
export function rememberMenuCode(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MENU_KEY, code);
}

export function getLastMenuCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(MENU_KEY);
}


export interface StoredOrder {
  code: string;
  establishment: string | null;
  total_cents: number;
  created_at: string;
}

function read(): StoredOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredOrder[]) : [];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry?.code === "string") : [];
  } catch {
    return [];
  }
}

export function listMyOrders(): StoredOrder[] {
  return read().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function rememberOrder(order: StoredOrder): void {
  if (typeof window === "undefined") return;
  const current = read().filter((entry) => entry.code.toLowerCase() !== order.code.toLowerCase());
  const next = [order, ...current].slice(0, 40);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("tapgo:my-orders"));
}

export function forgetOrder(code: string): void {
  if (typeof window === "undefined") return;
  const next = read().filter((entry) => entry.code.toLowerCase() !== code.toLowerCase());
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("tapgo:my-orders"));
}
