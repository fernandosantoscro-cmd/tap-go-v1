import { createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEstablishment, useEvents, usePaymentMethods, useStaff, useTableMutation } from "@/lib/admin-db";
import { STAFF_ROLE_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/equipe")({
  component: TeamPage,
});

const ROLES = ["administrador", "atendente", "cozinha", "bartender", "scanner"] as const;
type StaffRoleValue = (typeof ROLES)[number];

function scannerLink(pin: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/scanner?pin=${pin}`;
}

function TeamPage() {
  const establishment = useEstablishment();
  const staff = useStaff(establishment.data?.id);
  const events = useEvents(establishment.data?.id);
  const methods = usePaymentMethods(establishment.data?.id);
  const staffMutation = useTableMutation("staff", ["staff"]);
  const methodMutation = useTableMutation("payment_methods", ["payment-methods"]);

  const [form, setForm] = useState<{ name: string; role: StaffRoleValue; pin: string; station: string; eventId: string }>({
    name: "",
    role: "scanner",
    pin: "",
    station: "",
    eventId: "",
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!establishment.data) return;
    if (form.pin.length < 4) {
      toast.error("O PIN precisa ter ao menos 4 dígitos");
      return;
    }
    staffMutation.mutate(
      {
        type: "insert",
        values: {
          establishment_id: establishment.data.id,
          name: form.name,
          role: form.role,
          pin: form.pin,
          station: form.station.trim() || null,
          event_id: form.eventId || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Funcionário cadastrado");
          setForm({ name: "", role: "scanner", pin: "", station: "", eventId: "" });
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  async function share(person: { name: string; pin: string }) {
    const link = scannerLink(person.pin);
    const text = `Acesso ao balcão TapGo (${person.name}) — PIN ${person.pin}: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Acesso ao balcão TapGo", text, url: link });
        return;
      } catch {
        /* usuário cancelou */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noreferrer");
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Equipe & Pagamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O PIN é uma credencial emitida por esta conta: o funcionário abre o scanner do estande dele e registra
          retiradas, sem acesso ao painel. Você, como dono, entra no scanner direto pelo login.
        </p>
      </header>

      {establishment.data?.access_code && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-secondary/40 p-5">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Código do estabelecimento</p>
            <p className="font-display text-2xl font-semibold tracking-[0.25em]">{establishment.data.access_code}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              O funcionário informa este código + o PIN dele em Entrar &gt; Sou funcionário.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => {
              void navigator.clipboard.writeText(establishment.data!.access_code);
              toast.success("Código copiado");
            }}
          >
            Copiar código
          </Button>
        </div>
      )}


      <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-background p-6 md:grid-cols-3">
        <div>
          <Label htmlFor="s-name">Nome</Label>
          <Input
            id="s-name"
            className="mt-1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="s-role">Função</Label>
          <select
            id="s-role"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as StaffRoleValue })}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {STAFF_ROLE_LABEL[role] ?? role}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="s-pin">PIN</Label>
          <Input
            id="s-pin"
            className="mt-1 tracking-[0.3em]"
            inputMode="numeric"
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            placeholder="1234"
            required
          />
        </div>
        <div>
          <Label htmlFor="s-station">Estande / balcão</Label>
          <Input
            id="s-station"
            className="mt-1"
            value={form.station}
            onChange={(e) => setForm({ ...form, station: e.target.value })}
            placeholder="Ex.: Bar Central"
          />
        </div>
        <div>
          <Label htmlFor="s-event">Evento</Label>
          <select
            id="s-event"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.eventId}
            onChange={(e) => setForm({ ...form, eventId: e.target.value })}
          >
            <option value="">Todos os eventos</option>
            {(events.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={staffMutation.isPending}>
            <Plus className="mr-2 size-4" /> Adicionar
          </Button>
        </div>
      </form>

      <div className="divide-y rounded-2xl border bg-background">
        {(staff.data ?? []).map((person) => (
          <div key={person.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-4">
              <QrCode value={scannerLink(person.pin)} size={84} title={`Acesso do balcão de ${person.name}`} />
              <div>
                <p className="font-medium">{person.name}</p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <KeyRound className="size-3.5" aria-hidden /> PIN {person.pin}
                  {person.station ? ` · ${person.station}` : ""}
                  {person.event_id
                    ? ` · ${events.data?.find((item) => item.id === person.event_id)?.name ?? "evento"}`
                    : " · todos os eventos"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(scannerLink(person.pin));
                      toast.success("Link do balcão copiado");
                    }}
                  >
                    <Copy className="mr-2 size-3.5" /> Copiar link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void share(person)}>
                    <Send className="mr-2 size-3.5" /> Enviar
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{STAFF_ROLE_LABEL[person.role] ?? person.role}</Badge>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={person.active}
                  onCheckedChange={(checked) =>
                    staffMutation.mutate({ type: "update", id: person.id, values: { active: checked } })
                  }
                />
                Ativo
              </label>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Excluir ${person.name}`}
                onClick={() => staffMutation.mutate({ type: "delete", id: person.id })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        {(staff.data?.length ?? 0) === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
        )}
      </div>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="text-xl font-semibold">Métodos de pagamento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No MVP o pagamento é simulado ponta a ponta, com jornada idêntica à real.
        </p>
        <div className="mt-4 divide-y rounded-xl border">
          {(methods.data ?? []).map((method) => (
            <div key={method.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{method.label}</p>
                <p className="text-xs text-muted-foreground">{method.method}</p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={method.enabled}
                  onCheckedChange={(checked) =>
                    methodMutation.mutate({ type: "update", id: method.id, values: { enabled: checked } })
                  }
                />
                Habilitado
              </label>
            </div>
          ))}
          {(methods.data?.length ?? 0) === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum método configurado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
