import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, PartyPopper, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MenuImportDialog } from "@/components/menu-import-dialog";
import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  markSetupDone,
  useEstablishment,
  useMenus,
  useStaff,
  useTableMutation,
  useUpdateSettings,
} from "@/lib/admin-db";

export const Route = createFileRoute("/_authenticated/admin/primeiros-passos")({
  head: () => ({
    meta: [
      { title: "Primeiros passos — TapGo" },
      { name: "description", content: "Configure seu estabelecimento, crie o cardápio e gere o QR Code do TapGo." },
      { property: "og:title", content: "Primeiros passos — TapGo" },
      { property: "og:description", content: "Assistente de configuração inicial do estabelecimento no TapGo." },
    ],
  }),
  component: SetupWizard,
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

const DEMO_PRODUCTS = [
  { name: "Chopp Pilsen", emoji: "🍺", price_cents: 1490, prep_minutes: 0, requires_prep: false, category: "Bebidas" },
  { name: "Gin tônica", emoji: "🍸", price_cents: 2900, prep_minutes: 0, requires_prep: false, category: "Bebidas" },
  { name: "Água mineral", emoji: "💧", price_cents: 700, prep_minutes: 0, requires_prep: false, category: "Bebidas" },
  { name: "Batata rústica", emoji: "🍟", price_cents: 3200, prep_minutes: 15, requires_prep: true, category: "Comidas" },
  { name: "Hambúrguer artesanal", emoji: "🍔", price_cents: 4200, prep_minutes: 20, requires_prep: true, category: "Comidas" },
];

function parseHours(value: unknown): Record<string, DayHours> {
  const source = (value ?? {}) as Record<string, Partial<DayHours>>;
  return Object.fromEntries(
    DAYS.map((day) => {
      const entry = source[day.key] ?? {};
      return [
        day.key,
        { open: entry.open ?? DEFAULT_DAY.open, from: entry.from ?? DEFAULT_DAY.from, to: entry.to ?? DEFAULT_DAY.to },
      ];
    }),
  );
}

const STEPS = ["Estabelecimento", "Funcionamento", "Cardápio", "Pronto"] as const;

function SetupWizard() {
  const navigate = useNavigate();
  const establishment = useEstablishment();
  const menus = useMenus(establishment.data?.id);
  const staff = useStaff(establishment.data?.id);
  const update = useUpdateSettings();
  const menuMutation = useTableMutation("menus", ["menus"]);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [type, setType] = useState("bar");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [accepting, setAccepting] = useState(true);
  const [hours, setHours] = useState<Record<string, DayHours>>(parseHours(null));
  const [menuName, setMenuName] = useState("Bar principal");
  const [seeding, setSeeding] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const data = establishment.data;
    if (!data || hydrated) return;
    setName(data.name === "Meu estabelecimento" ? "" : data.name);
    setType(data.type ?? "bar");
    setPhone(data.phone ?? "");
    setDocument(data.document ?? "");
    setAccepting(data.accepting_orders);
    setHours(parseHours(data.business_hours));
    setHydrated(true);
  }, [establishment.data, hydrated]);

  const firstMenu = menus.data?.[0] ?? null;
  const counterPin = (staff.data ?? []).find((member) => member.active)?.pin ?? null;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const menuUrl = firstMenu ? `${origin}/menu/${firstMenu.code}` : "";

  function saveStepOne() {
    if (!establishment.data) return;
    if (name.trim().length < 2) {
      toast.error("Informe o nome do estabelecimento");
      return;
    }
    update.mutate(
      {
        id: establishment.data.id,
        name: name.trim(),
        type,
        phone: phone.trim() || null,
        document: document.trim() || null,
      },
      {
        onSuccess: () => setStep(1),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  function saveStepTwo() {
    if (!establishment.data) return;
    update.mutate(
      {
        id: establishment.data.id,
        accepting_orders: accepting,
        business_hours: hours as unknown as Record<string, { open: boolean; from: string; to: string }>,
      } as Parameters<typeof update.mutate>[0],
      {
        onSuccess: () => setStep(2),
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  function createMenu(withDemo: boolean) {
    if (!establishment.data) return;
    setSeeding(true);
    menuMutation.mutate(
      { type: "insert", values: { establishment_id: establishment.data.id, name: menuName.trim() || "Cardápio" } },
      {
        onSuccess: async (created) => {
          const menu = created as unknown as { id: string };
          if (withDemo) {
            const categories = ["Bebidas", "Comidas"];
            const inserted = await supabase
              .from("categories")
              .insert(
                categories.map((label, index) => ({
                  establishment_id: establishment.data!.id,
                  menu_id: menu.id,
                  name: label,
                  sort_order: index,
                })),
              )
              .select();
            const byName = new Map((inserted.data ?? []).map((row) => [row.name, row.id]));
            const { error } = await supabase.from("products").insert(
              DEMO_PRODUCTS.map((product, index) => ({
                establishment_id: establishment.data!.id,
                menu_id: menu.id,
                category_id: byName.get(product.category) ?? null,
                name: product.name,
                emoji: product.emoji,
                price_cents: product.price_cents,
                prep_minutes: product.prep_minutes,
                requires_prep: product.requires_prep,
                sort_order: index,
              })),
            );
            if (error) toast.error(error.message);
          }
          setSeeding(false);
          await menus.refetch();
          toast.success("Cardápio criado");
          setStep(3);
        },
        onError: (error: Error) => {
          setSeeding(false);
          toast.error(error.message);
        },
      },
    );
  }

  function finish() {
    markSetupDone(establishment.data?.id);
    void navigate({ to: "/admin", replace: true });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-primary">Primeiros passos</p>
        <h1 className="mt-2 text-3xl font-semibold">Vamos preparar seu TapGo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quatro etapas rápidas: dados do negócio, funcionamento, cardápio e o QR Code para o cliente escanear.
        </p>
      </header>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs ${
              index === step
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : index < step
                  ? "text-muted-foreground"
                  : "text-muted-foreground/70"
            }`}
          >
            {index < step ? <Check className="size-3.5 text-primary" aria-hidden /> : <span>{index + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      <section className="rounded-3xl border bg-background p-6 sm:p-8">
        {step === 0 && (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="setup-name">Nome do estabelecimento</Label>
              <Input
                id="setup-name"
                className="mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Bar do Zé"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="setup-type">Tipo de negócio</Label>
                <select
                  id="setup-type"
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
                <Label htmlFor="setup-phone">WhatsApp</Label>
                <Input
                  id="setup-phone"
                  inputMode="tel"
                  className="mt-1"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-0000"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="setup-doc">CNPJ ou CPF (opcional)</Label>
              <Input
                id="setup-doc"
                className="mt-1"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveStepOne} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Continuar <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-2xl border bg-secondary/40 p-4">
              <div>
                <p className="text-sm font-medium">Aceitando pedidos</p>
                <p className="text-xs text-muted-foreground">Você pode pausar a qualquer momento nas configurações.</p>
              </div>
              <Switch checked={accepting} onCheckedChange={setAccepting} aria-label="Aceitando pedidos" />
            </div>

            <div className="grid gap-3">
              {DAYS.map((day) => {
                const value = hours[day.key] ?? DEFAULT_DAY;
                return (
                  <div key={day.key} className="grid items-center gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                    <span className="text-sm">{day.label}</span>
                    <Switch
                      checked={value.open}
                      onCheckedChange={(open) =>
                        setHours((current) => ({ ...current, [day.key]: { ...value, open } }))
                      }
                      aria-label={`${day.label} aberto`}
                    />
                    <Input
                      type="time"
                      value={value.from}
                      onChange={(e) => setHours((current) => ({ ...current, [day.key]: { ...value, from: e.target.value } }))}
                      className="w-32"
                      aria-label={`${day.label} abre`}
                    />
                    <Input
                      type="time"
                      value={value.to}
                      onChange={(e) => setHours((current) => ({ ...current, [day.key]: { ...value, to: e.target.value } }))}
                      className="w-32"
                      aria-label={`${day.label} fecha`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft className="mr-2 size-4" /> Voltar
              </Button>
              <Button onClick={saveStepTwo} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Continuar <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {firstMenu ? (
              <div className="rounded-2xl border bg-secondary/40 p-5">
                <p className="text-sm font-medium">Você já tem o cardápio “{firstMenu.name}”.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pode importar produtos por CSV/XML no editor ou seguir para o QR Code.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MenuImportDialog
                    menuId={firstMenu.id}
                    establishmentId={establishment.data?.id ?? ""}
                    existingCategories={[]}
                    onImported={() => toast.success("Produtos importados")}
                  />
                  <Button onClick={() => setStep(3)}>
                    Continuar <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="setup-menu">Nome do cardápio</Label>
                  <Input
                    id="setup-menu"
                    className="mt-1"
                    value={menuName}
                    onChange={(e) => setMenuName(e.target.value)}
                    placeholder="Bar principal"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Cada cardápio tem um QR Code próprio. Depois você pode criar quantos quiser (estandes, bares, food
                    trucks).
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button onClick={() => createMenu(true)} disabled={seeding || menuMutation.isPending}>
                    {seeding ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                    Criar com produtos de exemplo
                  </Button>
                  <Button variant="outline" onClick={() => createMenu(false)} disabled={seeding || menuMutation.isPending}>
                    Criar cardápio em branco
                  </Button>
                </div>
              </>
            )}
            <div>
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 size-4" /> Voltar
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <PartyPopper className="mt-0.5 size-5 text-primary" aria-hidden />
              <div>
                <h2 className="text-xl font-semibold">Tudo pronto para testar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escaneie o QR no celular, faça um pedido e marque como pronto no painel.
                </p>
              </div>
            </div>

            {firstMenu ? (
              <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
                <div className="flex justify-center rounded-2xl border p-4">
                  <QrCode value={menuUrl} size={180} title={`QR Code do cardápio ${firstMenu.name}`} />
                </div>
                <div className="grid gap-3">
                  <Field label="Link do cardápio" value={menuUrl} onCopy={() => void copy(menuUrl, "Link")} />
                  <Field
                    label="Código do estabelecimento (funcionário)"
                    value={establishment.data?.access_code ?? "—"}
                    onCopy={() => void copy(establishment.data?.access_code ?? "", "Código")}
                  />
                  <Field
                    label="PIN do balcão"
                    value={counterPin ?? "—"}
                    onCopy={() => void copy(counterPin ?? "", "PIN")}
                  />
                  <Field
                    label="Link do balcão (outro aparelho)"
                    value={`${origin}/acessar`}
                    onCopy={() => void copy(`${origin}/acessar`, "Link")}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Crie um cardápio na etapa anterior para gerar o QR Code.</p>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 size-4" /> Voltar
              </Button>
              <Button onClick={finish}>
                Ir para o painel <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-2xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{value}</p>
        <Button variant="ghost" size="icon" aria-label={`Copiar ${label}`} onClick={onCopy}>
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}
