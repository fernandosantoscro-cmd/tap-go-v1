/**
 * Canal único de avisos de "pronto para retirada". Qualquer tela publica aqui e
 * o componente global mostra o pop-up, evitando dois alertas concorrentes.
 */
export interface OrderAlert {
  id: string;
  code: string;
  itemName: string;
  quantity: number;
  /** Quando o cliente já está na tela do pedido, o botão rola até o QR. */
  sameScreen?: boolean;
}

type Listener = (alert: OrderAlert) => void;

const listeners = new Set<Listener>();

export function publishOrderAlert(alert: OrderAlert) {
  listeners.forEach((listener) => listener(alert));
}

export function subscribeOrderAlerts(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
