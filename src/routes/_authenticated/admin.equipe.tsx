import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEstablishment, usePaymentMethods, useStaff, useTableMutation } from "@/lib/admin-db";
import { STAFF_ROLE_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/equipe")({
  component: TeamPage,
});

const ROLES = ["administrador", "atendente", "cozinha", "bartender", "scanner"] as const;
type StaffRoleValue = (typeof ROLES)[number];

function TeamPage() {
  const establishment = useEstablishment();
  const staff = useStaff(establishment.data?.id);
  const methods = usePaymentMethods(establishment.data?.id);
  const staffMutation = useTableMutation("staff", ["staff"]);
  const methodMutation = useTableMutation("payment_methods", ["payment-methods"]);

  const [form, setForm] = useState<{ name: string; role: StaffRoleValue; pin: string }>({ name: "", role: "scanner", pin: "" });

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
        },
      },
      {
        onSuccess: () => {
          toast.success("Funcionário cadastrado");
          setForm({ name: "", role: "scanner", pin: "" });
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Equipe & Pagamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O PIN é a credencial do balcão: com ele o funcionário abre o scanner e registra retiradas.
        </p>
      </header>

      <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-background p-6 md:grid-cols-[2fr_1fr_1fr_auto]">
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
        <div className="flex items-end">
          <Button type="submit" disabled={staffMutation.isPending}>
            <Plus className="mr-2 size-4" /> Adicionar
          </Button>
        </div>
      </form>

      <div className="divide-y rounded-2xl border bg-background">
        {(staff.data ?? []).map((person) => (
          <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="font-medium">{person.name}</p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <KeyRound className="size-3.5" aria-hidden /> PIN {person.pin}
              </p>
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
