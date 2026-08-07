export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  recebido: "Recebido",
  preparando: "Preparando",
  pronto: "Pronto para retirada",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const STAFF_ROLE_LABEL: Record<string, string> = {
  administrador: "Administrador",
  atendente: "Atendente",
  cozinha: "Cozinha",
  bartender: "Bartender",
  scanner: "Scanner",
};
