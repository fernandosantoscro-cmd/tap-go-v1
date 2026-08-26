import { Link } from "@tanstack/react-router";
import { ListOrdered, QrCode, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";

import { getLastMenuCode } from "@/lib/my-orders";

/**
 * Barra inferior do PWA do cliente: cardápio, voucher aberto e histórico de pedidos.
 */
export function ClientTabBar({ voucherCode, menuCode }: { voucherCode?: string | undefined; menuCode?: string | undefined }) {
  const [lastMenu, setLastMenu] = useState<string | null>(null);
  useEffect(() => setLastMenu(menuCode ?? getLastMenuCode()), [menuCode]);

  const itemClass =
    "flex flex-col items-center gap-1 rounded-2xl py-2 text-xs text-muted-foreground transition-colors";
  const activeClass = { className: "bg-primary/10 font-medium text-foreground" };

  return (
    <nav
      aria-label="Navegação do cliente"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-xl grid-cols-3 gap-1 px-4 py-2">
        {lastMenu ? (
          <Link to="/menu/$code" params={{ code: lastMenu }} className={itemClass} activeProps={activeClass}>
            <UtensilsCrossed className="size-5" aria-hidden />
            Cardápio
          </Link>
        ) : (
          <span className={`${itemClass} opacity-60`}>
            <UtensilsCrossed className="size-5" aria-hidden />
            Cardápio
          </span>
        )}
        {voucherCode ? (
          <Link to="/voucher/$code" params={{ code: voucherCode }} className={itemClass} activeProps={activeClass}>
            <QrCode className="size-5" aria-hidden />
            Meu voucher
          </Link>
        ) : (
          <span className={`${itemClass} opacity-60`}>
            <QrCode className="size-5" aria-hidden />
            Meu voucher
          </span>
        )}
        <Link to="/meus-pedidos" className={itemClass} activeProps={activeClass}>
          <ListOrdered className="size-5" aria-hidden />
          Meus pedidos
        </Link>
      </div>
    </nav>
  );
}
