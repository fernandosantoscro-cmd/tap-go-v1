import { createFileRoute } from "@tanstack/react-router";
import QRCode from "qrcode";
import { Download, Plus, Printer, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/qr-code";
import { StaffHandoffDialog } from "@/components/staff-handoff-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishment, useEvents, useMenus, useRegenerateMenuCode, useStaff } from "@/lib/admin-db";

export const Route = createFileRoute("/_authenticated/admin/qrcodes")({
  component: QrCodesPage,
});

function menuUrl(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/menu/${code}`;
}

async function downloadQr(code: string, label: string) {
  const url = await QRCode.toDataURL(menuUrl(code), { width: 1024, margin: 2 });
  const link = document.createElement("a");
  link.href = url;
  link.download = `qrcode-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${code}.png`;
  link.click();
}

function QrCodesPage() {
  const establishment = useEstablishment();
  const menus = useMenus(establishment.data?.id);
  const events = useEvents(establishment.data?.id);
  const staff = useStaff(establishment.data?.id);
  const regenerate = useRegenerateMenuCode();

  const [stationName, setStationName] = useState("");
  const [creating, setCreating] = useState(false);

  /** Cria estande completo: evento + cardápio (código único) + PIN de balcão. */
  async function createStation(event: React.FormEvent) {
    event.preventDefault();
    const establishmentId = establishment.data?.id;
    if (!establishmentId || !stationName.trim()) return;
    setCreating(true);
    try {
      const name = stationName.trim();
      const { data: created, error: eventError } = await supabase
        .from("events")
        .insert({ establishment_id: establishmentId, name, active: true })
        .select("id")
        .single();
      if (eventError) throw new Error(eventError.message);

      const { error: menuError } = await supabase
        .from("menus")
        .insert({ establishment_id: establishmentId, event_id: created.id, name, active: true });
      if (menuError) throw new Error(menuError.message);

      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const { error: staffError } = await supabase.from("staff").insert({
        establishment_id: establishmentId,
        event_id: created.id,
        station: name,
        name: `Balcão ${name}`,
        role: "scanner",
        pin,
        active: true,
      });
      if (staffError) throw new Error(staffError.message);

      setStationName("");
      await Promise.all([menus.refetch(), events.refetch(), staff.refetch()]);
      toast.success(`Estande "${name}" criado com QR próprio e PIN ${pin}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o estande");
    } finally {
      setCreating(false);
    }
  }

  const rows = (menus.data ?? []).map((menu) => ({
    menu,
    eventName: events.data?.find((item) => item.id === menu.event_id)?.name ?? null,
    pins: (staff.data ?? []).filter((person) => person.active && person.event_id === menu.event_id),
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-semibold">QR Codes dos estandes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada estande tem um cardápio com código único: o QR abre só o cardápio dele e os pedidos nascem vinculados
            àquele estande. Imprima e cole no balcão.
          </p>
        </div>
        <StaffHandoffDialog />
      </header>


      <form
        onSubmit={createStation}
        className="grid gap-3 rounded-2xl border bg-background p-6 sm:grid-cols-[1fr_auto] print:hidden"
      >
        <div>
          <Label htmlFor="station">Novo estande</Label>
          <Input
            id="station"
            className="mt-1"
            value={stationName}
            onChange={(e) => setStationName(e.target.value)}
            placeholder="Ex.: Bar Central, Food Truck, Deck"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Cria evento, cardápio com código único e o PIN de balcão desse estande.
          </p>
        </div>
        <div className="flex items-start sm:pt-6">
          <Button type="submit" disabled={creating}>
            <Plus className="mr-2 size-4" /> {creating ? "Criando…" : "Criar estande"}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 size-4" /> Imprimir folha
        </Button>
        <Button
          variant="outline"
          onClick={() => rows.forEach((row) => void downloadQr(row.menu.code, row.menu.name))}
          disabled={rows.length === 0}
        >
          <Download className="mr-2 size-4" /> Baixar todos
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <article
            key={row.menu.id}
            className="flex flex-col items-center gap-3 rounded-2xl border bg-background p-6 text-center print:break-inside-avoid"
          >
            <div>
              <h2 className="text-lg font-semibold">{row.menu.name}</h2>
              <p className="text-xs text-muted-foreground">{row.eventName ?? "Sem evento vinculado"}</p>
            </div>
            <QrCode value={menuUrl(row.menu.code)} size={200} title={`QR Code do cardápio ${row.menu.name}`} />
            <p className="font-display text-lg font-semibold tracking-[0.25em]">{row.menu.code.toUpperCase()}</p>
            <p className="break-all text-xs text-muted-foreground">{menuUrl(row.menu.code)}</p>
            {row.pins.length > 0 && (
              <p className="text-xs text-muted-foreground print:hidden">
                PIN do balcão: {row.pins.map((person) => person.pin).join(", ")}
              </p>
            )}
            <div className="mt-1 flex flex-wrap justify-center gap-2 print:hidden">
              <Button size="sm" variant="outline" onClick={() => void downloadQr(row.menu.code, row.menu.name)}>
                <Download className="mr-2 size-4" /> PNG
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  regenerate.mutate(row.menu.id, {
                    onSuccess: () => toast.success("Novo código gerado — imprima o QR novamente"),
                    onError: (error: Error) => toast.error(error.message),
                  })
                }
              >
                <RefreshCcw className="mr-2 size-4" /> Novo código
              </Button>
            </div>
          </article>
        ))}
        {rows.length === 0 && (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Nenhum cardápio ainda. Crie um estande acima para gerar o primeiro QR Code.
          </p>
        )}
      </div>
    </div>
  );
}
