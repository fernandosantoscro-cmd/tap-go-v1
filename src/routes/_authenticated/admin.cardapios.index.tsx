import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Plus, QrCode as QrCodeIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEstablishment, useEvents, useMenus, useTableMutation } from "@/lib/admin-db";

export const Route = createFileRoute("/_authenticated/admin/cardapios/")({
  component: MenusPage,
});

function MenusPage() {
  const establishment = useEstablishment();
  const events = useEvents(establishment.data?.id);
  const menus = useMenus(establishment.data?.id);
  const mutate = useTableMutation("menus", ["menus"]);

  const [name, setName] = useState("");
  const [eventId, setEventId] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!establishment.data) return;
    mutate.mutate(
      {
        type: "insert",
        values: {
          establishment_id: establishment.data.id,
          event_id: eventId || (events.data?.[0]?.id ?? null),
          name,
        },
      },
      {
        onSuccess: () => {
          toast.success("Cardápio criado — agora cadastre os produtos");
          setName("");
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Cardápios & QR Code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada cardápio tem um QR Code próprio. Imprima e coloque nas mesas, pulseiras ou totens.
        </p>
      </header>

      <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-background p-6 md:grid-cols-[2fr_2fr_auto]">
        <div>
          <Label htmlFor="menu-name">Nome do cardápio</Label>
          <Input
            id="menu-name"
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bar principal"
            required
          />
        </div>
        <div>
          <Label htmlFor="menu-event">Evento</Label>
          <select
            id="menu-event"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="">Sem evento vinculado</option>
            {(events.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={mutate.isPending}>
            <Plus className="mr-2 size-4" /> Criar
          </Button>
        </div>
      </form>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(menus.data ?? []).map((menu) => {
          const url = `${origin}/menu/${menu.code}`;
          return (
            <article key={menu.id} className="rounded-2xl border bg-background p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{menu.name}</h2>
                  <p className="mt-1 font-display text-sm tracking-[0.2em] text-muted-foreground">
                    {menu.code.toUpperCase()}
                  </p>
                </div>
                <Badge variant={menu.active ? "default" : "secondary"}>{menu.active ? "Ativo" : "Inativo"}</Badge>
              </div>

              <div className="mt-4 flex justify-center rounded-xl border p-4">
                <QrCode value={url} size={168} title={`QR Code do cardápio ${menu.name}`} />
              </div>

              <div className="mt-4 grid gap-2">
                <Button asChild size="sm">
                  <Link to="/admin/cardapios/$menuId" params={{ menuId: menu.id }}>
                    <QrCodeIcon className="mr-2 size-4" /> Produtos & QR grande
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(url);
                    toast.success("Link copiado");
                  }}
                >
                  Copiar link do cardápio
                </Button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:underline"
                >
                  <ExternalLink className="size-3.5" /> Abrir como cliente
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Excluir o cardápio ${menu.name}?`)) {
                      mutate.mutate(
                        { type: "delete", id: menu.id },
                        { onError: (error: Error) => toast.error(error.message) },
                      );
                    }
                  }}
                >
                  <Trash2 className="mr-2 size-4" /> Excluir
                </Button>
              </div>
            </article>
          );
        })}
        {(menus.data?.length ?? 0) === 0 && (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            Nenhum cardápio criado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
