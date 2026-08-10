import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { OrderQueue } from "@/components/order-queue";
import { PickupConsole } from "@/components/pickup-console";
import { StaffHandoffDialog } from "@/components/staff-handoff-dialog";
import { Button } from "@/components/ui/button";
import { useEstablishment } from "@/lib/admin-db";
import {
  ownerFetchVoucher,
  ownerListOpenOrders,
  ownerRegisterPickup,
  ownerSetItemStatusByCode,
} from "@/lib/owner-pickup.functions";


export const Route = createFileRoute("/_authenticated/admin/retirada")({
  component: PickupPage,
});

function PickupPage() {
  const establishment = useEstablishment();
  const queryClient = useQueryClient();
  const lookup = useServerFn(ownerFetchVoucher);
  const pickup = useServerFn(ownerRegisterPickup);
  const markReady = useServerFn(ownerSetItemStatusByCode);
  const listOpen = useServerFn(ownerListOpenOrders);
  const [openRequest, setOpenRequest] = useState<{ code: string; nonce: number } | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Retirada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Libere cada produto na fila e depois leia o QR Code do voucher. Sem PIN: usa a conta de{" "}
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

      <OrderQueue
        scope="owner"
        onList={() => listOpen()}
        onSetItemStatus={(code, itemId, status) => markReady({ data: { code, itemId, status } })}
        onOpenOrder={(code) => setOpenRequest({ code, nonce: Date.now() })}
      />

      <PickupConsole
        onLookup={(code) => lookup({ data: { code } })}
        onRegister={(code, items) => pickup({ data: { code, items } })}
        onMarkReady={(code, itemId) => markReady({ data: { code, itemId, status: "pronto" } })}
        openRequest={openRequest}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: ["order-queue", "owner"] })}
      />
    </div>
  );
}
