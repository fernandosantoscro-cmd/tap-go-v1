import { createFileRoute } from "@tanstack/react-router";
import { Clock, FileText, MonitorDown, Save, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { InstallButton } from "@/components/install-button";
import { IntegrationsSettings } from "@/components/integrations-settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEstablishment, useOpenState, useUpdateSettings } from "@/lib/admin-db";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: SettingsPage,
});

interface DayHours {
  open: boolean;
  from: string;
  to: string;
}

const DAYS = [
  { key: "1", label: "Segunda" },
  { key: "2", label: "Terça" },
  { key: "3", label: "Quarta" },
  { key: "4", label: "Quinta" },
  { key: "5", label: "Sexta" },
  { key: "6", label: "Sábado" },
  { key: "0", label: "Domingo" },
] as const;

const DEFAULT_DAY: DayHours = { open: true, from: "10:00", to: "23:59" };

const TYPES = [
  { value: "bar", label: "Bar" },
  { value: "festival", label: "Festival" },
  { value: "arena", label: "Arena / casa de show" },
  { value: "beach_club", label: "Beach club" },
  { value: "restaurante", label: "Restaurante" },
  { value: "outro", label: "Outro" },
];

function parseHours(value: unknown): Record<string, DayHours> {
  const source = (value ?? {}) as Record<string, Partial<DayHours>>;
  return Object.fromEntries(
    DAYS.map((day) => {
      const entry = source[day.key] ?? {};
      return [
        day.key,
        {
          open: entry.open ?? DEFAULT_DAY.open,
          from: entry.from ?? DEFAULT_DAY.from,
          to: entry.to ?? DEFAULT_DAY.to,
        },
      ];
    }),
  );
}

function SettingsPage() {
  const establishment = useEstablishment();
  const openState = useOpenState(establishment.data?.id);
  const update = useUpdateSettings();

  const [name, setName] = useState("");
  const [type, setType] = useState("bar");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [closedMessage, setClosedMessage] = useState("");
  const [accepting, setAccepting] = useState(true);
  const [hours, setHours] = useState<Record<string, DayHours>>(parseHours(null));
  const [municipalReg, setMunicipalReg] = useState("");
  const [stateReg, setStateReg] = useState("");
  const [taxRegime, setTaxRegime] = useState("simples");

  useEffect(() => {
    const data = establishment.data;
    if (!data) return;
    setName(data.name);
    setType(data.type ?? "bar");
    setPhone(data.phone ?? "");
    setDocument(data.document ?? "");
    setClosedMessage(data.closed_message ?? "");
    setAccepting(data.accepting_orders);
    setHours(parseHours(data.business_hours));
    const extra = data as unknown as Record<string, unknown>;
    setMunicipalReg(String(extra["municipal_registration"] ?? ""));
    setStateReg(String(extra["state_registration"] ?? ""));
    setTaxRegime(String(extra["tax_regime"] ?? "simples"));
  }, [establishment.data]);

  function save() {
    if (!establishment.data) return;
    update.mutate(
      {
        id: establishment.data.id,
        name: name.trim() || establishment.data.name,
        type,
        phone: phone.trim() || null,
        document: document.trim() || null,
        closed_message: closedMessage.trim() || null,
        accepting_orders: accepting,
        business_hours: hours as unknown as Record<string, { open: boolean; from: string; to: string }>,
        municipal_registration: municipalReg.trim() || null,
        state_registration: stateReg.trim() || null,
        tax_regime: taxRegime,
      } as Parameters<typeof update.mutate>[0],
      {
        onSuccess: () => toast.success("Configurações salvas"),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  function setDay(key: string, patch: Partial<DayHours>) {
    setHours((current) => ({ ...current, [key]: { ...(current[key] ?? DEFAULT_DAY), ...patch } }));
  }

  const state = openState.data;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Configurações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dados do estabelecimento, horário de funcionamento e pausa de pedidos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {state && (
            <Badge variant={state.open ? "default" : "secondary"}>
              {state.open
                ? `Aberto agora · ${state.local_time ?? ""}`
                : state.reopen_at
                  ? `Fechado · reabre às ${state.reopen_at}`
                  : "Fechado"}
            </Badge>
          )}
          <Button onClick={save} disabled={update.isPending}>
            <Save className="mr-2 size-4" /> {update.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </header>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Store className="size-5 text-primary" aria-hidden /> Estabelecimento
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="set-name">Nome</Label>
            <Input id="set-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="set-type">Tipo de negócio</Label>
            <select
              id="set-type"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="set-phone">WhatsApp</Label>
            <Input id="set-phone" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="set-doc">CNPJ / CPF</Label>
            <Input id="set-doc" className="mt-1" value={document} onChange={(e) => setDocument(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="set-im">Inscrição municipal</Label>
            <Input id="set-im" className="mt-1" value={municipalReg} onChange={(e) => setMunicipalReg(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="set-ie">Inscrição estadual</Label>
            <Input id="set-ie" className="mt-1" value={stateReg} onChange={(e) => setStateReg(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="set-regime">Regime tributário</Label>
            <select
              id="set-regime"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={taxRegime}
              onChange={(e) => setTaxRegime(e.target.value)}
            >
              <option value="simples">Simples Nacional</option>
              <option value="mei">MEI</option>
              <option value="presumido">Lucro presumido</option>
              <option value="real">Lucro real</option>
            </select>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-3.5" aria-hidden /> Os dados fiscais alimentam a emissão automática de nota nas
          Integrações abaixo.
        </p>
      </section>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Clock className="size-5 text-primary" aria-hidden /> Funcionamento
        </h2>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <p className="font-medium">Aceitar novos pedidos</p>
            <p className="text-sm text-muted-foreground">
              Desligue para pausar o cardápio imediatamente, mesmo dentro do horário.
            </p>
          </div>
          <Switch checked={accepting} onCheckedChange={setAccepting} aria-label="Aceitar pedidos" />
        </div>

        <ul className="mt-5 space-y-3">
          {DAYS.map((day) => {
            const value = hours[day.key] ?? DEFAULT_DAY;
            return (
              <li key={day.key} className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
                <span className="w-24 font-medium">{day.label}</span>
                <Switch
                  checked={value.open}
                  onCheckedChange={(checked) => setDay(day.key, { open: checked })}
                  aria-label={`${day.label} aberto`}
                />
                <span className="text-sm text-muted-foreground">{value.open ? "Aberto" : "Fechado"}</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    className="h-9 w-28"
                    aria-label={`Abertura ${day.label}`}
                    value={value.from}
                    disabled={!value.open}
                    onChange={(e) => setDay(day.key, { from: e.target.value })}
                  />
                  <span className="text-muted-foreground">até</span>
                  <Input
                    type="time"
                    className="h-9 w-28"
                    aria-label={`Fechamento ${day.label}`}
                    value={value.to}
                    disabled={!value.open}
                    onChange={(e) => setDay(day.key, { to: e.target.value })}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-5">
          <Label htmlFor="closed-msg">Mensagem quando fechado</Label>
          <Textarea
            id="closed-msg"
            className="mt-1"
            rows={2}
            placeholder="Estamos fechados agora. Voltamos hoje às 18h!"
            value={closedMessage}
            onChange={(e) => setClosedMessage(e.target.value)}
          />
        </div>

        <Button className="mt-6" onClick={save} disabled={update.isPending}>
          <Save className="mr-2 size-4" /> {update.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </section>

      <IntegrationsSettings />

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <MonitorDown className="size-5 text-primary" aria-hidden /> Aplicativo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Instale o TapGo no computador ou no celular da equipe para abrir o painel e a retirada em
          janela própria, sem abas do navegador.
        </p>
        <div className="mt-4">
          <InstallButton variant="outline" label="Instalar o TapGo" />
        </div>
      </section>
    </div>
  );
}
