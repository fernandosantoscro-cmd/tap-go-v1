import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";

import { PickupConsole } from "@/components/pickup-console";
import { Button } from "@/components/ui/button";
import { useEstablishment } from "@/lib/admin-db";
import { ownerFetchVoucher, ownerRegisterPickup, ownerSetItemStatusByCode } from "@/lib/owner-pickup.functions";

export const Route = createFileRoute("/_authenticated/admin/retirada")({
  component: PickupPage,
});

function PickupPage() {
  const establishment = useEstablishment();
  const lookup = useServerFn(ownerFetchVoucher);
  const pickup = useServerFn(ownerRegisterPickup);
  const markReady = useServerFn(ownerSetItemStatusByCode);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Retirada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Leia o QR Code do voucher pela câmera deste dispositivo. Sem PIN: usa a conta de{" "}
            <strong>{establishment.data?.name ?? "seu estabelecimento"}</strong>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/qrcodes">QR Codes dos estandes</Link>
          </Button>
          <Button asChild variant="outline">
            <a href="/scanner" target="_blank" rel="noreferrer">
              Abrir em outro aparelho
              <ExternalLink className="ml-2 size-4" />
            </a>
          </Button>
        </div>
      </header>

      <PickupConsole
        onLookup={(code) => lookup({ data: { code } })}
        onRegister={(code, items) => pickup({ data: { code, items } })}
        onMarkReady={(code, itemId) => markReady({ data: { code, itemId, status: "pronto" } })}
      />
    </div>
  );
}
