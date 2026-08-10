import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ClipboardList, QrCode, ScanLine, Store, Utensils } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useEstablishment,
  useMenus,
  useStaff,
  useTableMutation,
  useUpdateSettings,
  type MenuRow,
} from "@/lib/admin-db";

const DONE_KEY = "tapgo.onboarding.done";

const STEPS = ["Estabelecimento", "Cardápio", "QR Code", "Operação"] as const;

export function OnboardingDialog() {
  const establishment = useEstablishment();
  const menus = useMenus(establishment.data?.id);
  const staff = useStaff(establishment.data?.id);
  const updateEstablishment = useUpdateSettings();
  const createMenu = useTableMutation("menus", ["menus"]);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [menuName, setMenuName] = useState("Cardápio principal");

  const firstMenu: MenuRow | undefined = menus.data?.[0];
  const pin = staff.data?.find((member) => member.active)?.pin;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DONE_KEY) === "1") return;
    if (!establishment.data) return;
    setOpen(true);
  }, [establishment.data]);

  useEffect(() => {
    if (!establishment.data) return;
    setName((current) => current || establishment.data.name);
    setPhone((current) => current || establishment.data.phone || "");
  }, [establishment.data]);

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  function finish() {
    if (typeof window !== "undefined") localStorage.setItem(DONE_KEY, "1");
    setOpen(false);
  }

  async function saveEstablishment() {
    if (!establishment.data) return;
    if (!name.trim()) {
      toast.error("Informe o nome do estabelecimento.");
      return;
    }
    try {
      await updateEstablishment.mutateAsync({
        id: establishment.data.id,
        name: name.trim(),
        phone: phone.trim() || null,
      });
      setStep(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  }

  async function saveMenu() {
    if (!establishment.data) return;
    if (firstMenu) {
      setStep(2);
      return;
    }
    if (!menuName.trim()) {
      toast.error("Dê um nome ao cardápio.");
      return;
    }
    try {
      await createMenu.mutateAsync({
        type: "insert",
        values: { establishment_id: establishment.data.id, name: menuName.trim() },
      });
      toast.success("Cardápio criado.");
      setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o cardápio.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : finish())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            {step === 0 && <Store className="size-5 text-primary" aria-hidden />}
            {step === 1 && <Utensils className="size-5 text-primary" aria-hidden />}
            {step === 2 && <QrCode className="size-5 text-primary" aria-hidden />}
            {step === 3 && <ScanLine className="size-5 text-primary" aria-hidden />}
            {STEPS[step]}
          </DialogTitle>
          <DialogDescription>
            Passo {step + 1} de {STEPS.length} · leva menos de 2 minutos.
          </DialogDescription>
        </DialogHeader>

        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esses dados aparecem no cardápio e no comprovante do cliente.
            </p>
            <div className="space-y-2">
              <Label htmlFor="ob-name">Nome do estabelecimento</Label>
              <Input id="ob-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Arena Live Club" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-phone">WhatsApp / telefone (opcional)</Label>
              <Input id="ob-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-0000" />
            </div>
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={finish}>
                Pular
              </Button>
              <Button onClick={() => void saveEstablishment()} disabled={updateEstablishment.isPending}>
                Continuar <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O cardápio é o que o cliente vê ao escanear o QR Code. Depois você adiciona produtos manualmente ou importa
              um arquivo CSV/XML.
            </p>
            {firstMenu ? (
              <div className="rounded-xl border bg-muted/40 p-4 text-sm">
                <Check className="mb-2 size-4 text-primary" aria-hidden />
                Você já tem o cardápio <strong>{firstMenu.name}</strong>.
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="ob-menu">Nome do cardápio</Label>
                <Input id="ob-menu" value={menuName} onChange={(event) => setMenuName(event.target.value)} />
              </div>
            )}
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button onClick={() => void saveMenu()} disabled={createMenu.isPending}>
                Continuar <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cada cardápio tem um QR Code próprio. Imprima e cole nas mesas ou nos estandes: o cliente escaneia, monta o
              pedido, paga e recebe um voucher com QR único.
            </p>
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Onde encontrar</p>
              <p className="mt-1 text-muted-foreground">
                Menu <strong>QR Codes</strong> para baixar/imprimir, ou dentro do cardápio para regenerar o código.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/admin/qrcodes" onClick={finish}>
                  Abrir QR Codes
                </Link>
              </Button>
            </div>
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={() => setStep(3)}>
                Continuar <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <ul className="space-y-3 text-sm">
              <li className="flex gap-3">
                <ClipboardList className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <strong>Pedidos</strong> mostra tudo em tempo real. Marque item por item como pronto — o cliente vê a
                  mudança no celular na hora.
                </span>
              </li>
              <li className="flex gap-3">
                <ScanLine className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <strong>Retirada</strong> abre a câmera para ler o voucher e dar baixa (pode ser parcial, item por
                  item).
                </span>
              </li>
              <li className="flex gap-3">
                <QrCode className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Seu atendente usa o celular dele com o PIN do posto{pin ? <> (atual: <strong>{pin}</strong>)</> : null} —
                  sem precisar de login.
                </span>
              </li>
              <li className="flex gap-3">
                <Store className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Em <strong>Configurações</strong> você define horários, pausa os pedidos e em <strong>Relatórios</strong>{" "}
                  filtra por data e exporta CSV.
                </span>
              </li>
            </ul>
            <div className="flex justify-between gap-3">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button asChild onClick={finish}>
                <Link to={firstMenu ? "/admin/cardapios/$menuId" : "/admin/cardapios"} params={{ menuId: firstMenu?.id ?? "" }}>
                  Ir para o cardápio <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
