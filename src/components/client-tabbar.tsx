import { Link } from "@tanstack/react-router";
import { ListOrdered, QrCode } from "lucide-react";

/**
 * Barra inferior do PWA do cliente: dois destinos apenas, para o cliente nunca
 * se perder entre o voucher aberto e a lista de pedidos.
 */
export function ClientTabBar({ voucherCode }: { voucherCode?: string | undefined }) {
  return (
    <nav
      aria-label="Navegação do cliente"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-xl grid-cols-2 gap-1 px-4 py-2">
        {voucherCode ? (
          <Link
            to="/voucher/$code"
            params={{ code: voucherCode }}
            className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-muted-foreground transition-colors"
            activeProps={{ className: "bg-primary/10 font-medium text-foreground" }}
          >
            <QrCode className="size-5" aria-hidden />
            Meu voucher
          </Link>
        ) : (
          <span className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground/60">
            <QrCode className="size-5" aria-hidden />
            Meu voucher
          </span>
        )}
        <Link
          to="/meus-pedidos"
          className="flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-muted-foreground transition-colors"
          activeProps={{ className: "bg-primary/10 font-medium text-foreground" }}
        >
          <ListOrdered className="size-5" aria-hidden />
          Meus pedidos
        </Link>
      </div>
    </nav>
  );
}
