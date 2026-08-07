import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEstablishment, useEvents, useTableMutation } from "@/lib/admin-db";

export const Route = createFileRoute("/_authenticated/admin/eventos")({
  component: EventsPage,
});

function EventsPage() {
  const establishment = useEstablishment();
  const events = useEvents(establishment.data?.id);
  const mutate = useTableMutation("events", ["events"]);

  const [form, setForm] = useState({
    name: "",
    description: "",
    location: "",
    event_date: "",
    start_time: "",
    end_time: "",
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!establishment.data) return;
    mutate.mutate(
      {
        type: "insert",
        values: {
          establishment_id: establishment.data.id,
          name: form.name,
          description: form.description || null,
          location: form.location || null,
          event_date: form.event_date || null,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Evento criado");
          setForm({ name: "", description: "", location: "", event_date: "", start_time: "", end_time: "" });
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Eventos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada cardápio pertence a um evento — festa, festival, temporada ou operação do dia a dia.
        </p>
      </header>

      <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-background p-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="name">Nome do evento</Label>
          <Input
            id="name"
            className="mt-1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sunset Session — Sábado"
            required
          />
        </div>
        <div>
          <Label htmlFor="date">Data</Label>
          <Input
            id="date"
            type="date"
            className="mt-1"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="location">Local</Label>
          <Input
            id="location"
            className="mt-1"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Arena Live Club — Pista"
          />
        </div>
        <div>
          <Label htmlFor="start">Início</Label>
          <Input
            id="start"
            type="time"
            className="mt-1"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="end">Fim</Label>
          <Input
            id="end"
            type="time"
            className="mt-1"
            value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            className="mt-1"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Open bar de drinks autorais e food trucks."
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={mutate.isPending}>
            <Plus className="mr-2 size-4" /> Criar evento
          </Button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {(events.data ?? []).map((item) => (
          <article key={item.id} className="rounded-2xl border bg-background p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{item.name}</h2>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {item.event_date ?? "Sem data"} · {item.start_time?.slice(0, 5) ?? "--"} às{" "}
                  {item.end_time?.slice(0, 5) ?? "--"}
                </p>
                {item.location && <p className="mt-1 text-xs text-muted-foreground">{item.location}</p>}
              </div>
              <Badge variant={item.active ? "default" : "secondary"}>{item.active ? "Ativo" : "Inativo"}</Badge>
            </div>
            {item.description && <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>}
            <div className="mt-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={item.active}
                  onCheckedChange={(checked) =>
                    mutate.mutate({ type: "update", id: item.id, values: { active: checked } })
                  }
                />
                Ativo
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Excluir o evento ${item.name}?`)) {
                    mutate.mutate(
                      { type: "delete", id: item.id },
                      { onError: (error: Error) => toast.error(error.message) },
                    );
                  }
                }}
              >
                <Trash2 className="mr-2 size-4" /> Excluir
              </Button>
            </div>
          </article>
        ))}
        {(events.data?.length ?? 0) === 0 && (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground md:col-span-2">
            Nenhum evento cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
