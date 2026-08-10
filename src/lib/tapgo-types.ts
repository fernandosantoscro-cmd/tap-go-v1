export type OrderStatus =
  | "aguardando_pagamento"
  | "recebido"
  | "preparando"
  | "pronto"
  | "entregue"
  | "cancelado";

export interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  emoji: string | null;
  price_cents: number;
  prep_minutes: number;
  requires_prep: boolean;
  available: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  products: MenuProduct[] | null;
}

export interface OpenState {
  open: boolean;
  within_hours: boolean;
  accepting_orders: boolean;
  reopen_at: string | null;
  closed_message: string | null;
  local_time: string | null;
}

export interface MenuPayload {
  menu: { id: string; name: string; code: string; image_url: string | null };
  establishment: { id: string; name: string; logo_url: string | null; type?: string | null };
  open_state?: OpenState | null;

  event: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    location: string | null;
    event_date: string | null;
    start_time: string | null;
    end_time: string | null;
    active: boolean;
  } | null;
  categories: MenuCategory[];
}

export interface VoucherItem {
  id: string;
  name: string;
  emoji: string | null;
  unit_price_cents: number;
  quantity: number;
  delivered_quantity: number;
  available_quantity: number;
  prep_minutes: number;
  requires_prep: boolean;
  status: OrderStatus;
}

export interface VoucherPayload {
  order: {
    code: string;
    status: OrderStatus;
    payment_status: "pendente" | "pago" | "falhou" | "estornado";
    payment_method: string | null;
    total_cents: number;
    created_at: string;
    paid_at: string | null;
    payment_reference: string | null;
  };
  establishment: { name: string } | null;
  event: { name: string; location: string | null } | null;
  menu: { name: string } | null;
  items: VoucherItem[];
}

export interface StaffSession {
  id: string;
  name: string;
  role: "administrador" | "atendente" | "cozinha" | "bartender" | "scanner";
  establishment: string;
  establishment_id?: string | null;
  station?: string | null;
  event_id?: string | null;
  event?: string | null;
}


export interface CartLine {
  product_id: string;
  quantity: number;
}
