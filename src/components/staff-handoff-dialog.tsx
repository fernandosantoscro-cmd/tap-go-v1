import QRCode from "qrcode";
import { Link } from "@tanstack/react-router";
import { Copy, Download, ExternalLink, MessageCircle, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEstablishment, useEvents, useStaff } from "@/lib/admin-db";

/**
 * Entrega o balcão para o celular do atendente: escolhe o posto (PIN emitido
 * pela conta) e mostra QR + link que já abre /scanner logado naquele estande.
 */
export function StaffHandoffDialog() {
  const establishment = useEstablishment();
  const staff = useStaff(establishment.data?.id);
  const events = useEvents(establishment.data?.id);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const options = useMemo(
    () => (staff.data ?? []).filter((row) => row.active && row.pin),
    [staff.data],
  );
  const current = options.find((row) => row.id === selected) ?? options[0] ?? null;

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = current ? `${origin}/scanner?pin=${current.pin}` : "";

  function eventName(id: string | null) {
    if (!id) return null;
    return (events.data ?? []).find((event) => event.id === id)?.name ?? null;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado — envie para o atendente");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link manualmente.");
    }
  }

  async function downloadQr() {
    if (!current) return;
    const dataUrl = await QRCode.toDataURL(link, { width: 1024, margin: 2 });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `balcao-${current.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    anchor.click();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Smartphone className="mr-2 size-4" />
          Passar para o celular
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Balcão no celular do atendente</DialogTitle>
          <DialogDescription>
            O atendente escaneia este QR no celular dele e o balcão abre já no estande escolhido — sem
            login e sem digitar nada.
          </DialogDescription>
        </DialogHeader>

        {options.length === 0 ? (
          <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
            Nenhum posto com PIN ativo ainda. Crie um em Equipe e volte aqui.
            <Button asChild variant="link" className="mt-2 h-auto p-0 text-sm">
              <Link to="/admin/equipe" onClick={() => setOpen(false)}>
                Abrir Equipe
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="posto">Posto do atendente</Label>
              <div className="mt-2 grid gap-2">
                {options.map((row) => {
                  const active = current?.id === row.id;
                  const event = eventName(row.event_id);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelected(row.id)}
                      className={`rounded-2xl border p-3 text-left text-sm transition ${
                        active ? "border-primary bg-primary/10" : "hover:bg-secondary"
                      }`}
                    >
                      <span className="font-medium">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[row.station, event].filter(Boolean).join(" · ") || "Todos os estandes"} · PIN{" "}
                        {row.pin}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {current && (
              <>
                <div className="flex flex-col items-center rounded-3xl border p-5">
                  <QrCode value={link} size={200} title={`QR de acesso do balcão de ${current.name}`} />
                  <p className="mt-3 break-all text-center text-xs text-muted-foreground">{link}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" onClick={() => void copyLink()}>
                    <Copy className="mr-2 size-4" /> Copiar link
                  </Button>
                  <Button variant="outline" asChild>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Balcão ${current.name}: abra este link no seu celular ${link}`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-2 size-4" /> WhatsApp
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => void downloadQr()}>
                    <Download className="mr-2 size-4" /> Baixar QR
                  </Button>
                  <Button asChild>
                    <Link to="/scanner" search={{ pin: current.pin }} onClick={() => setOpen(false)}>
                      <ExternalLink className="mr-2 size-4" /> Abrir aqui
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
