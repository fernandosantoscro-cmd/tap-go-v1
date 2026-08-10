import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, ScanLine, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { OrderQueue } from "@/components/order-queue";
import { PickupConsole } from "@/components/pickup-console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { STAFF_ROLE_LABEL } from "@/lib/format";
import {
  ownerFetchVoucher,
  ownerListOpenOrders,
  ownerRegisterPickup,
  ownerSetItemStatusByCode,
} from "@/lib/owner-pickup.functions";
import {
  registerPickup,
  staffGetOrder,
  staffListOpenOrders,
  staffLogin,
  staffSetItemStatus,
} from "@/lib/tapgo.functions";
import type { StaffSession } from "@/lib/tapgo-types";

const PIN_KEY = "tapgo.staff.pin";
const SESSION_KEY = "tapgo.staff.session";

export const Route = createFileRoute("/scanner")({
  validateSearch: (search: Record<string, unknown>): { pin?: string } => {
    const raw = search["pin"] == null ? "" : String(search["pin"]).replace(/\D/g, "").slice(0, 6);
    return raw.length >= 4 ? { pin: raw } : {};
  },


  head: () => ({
    meta: [
      { title: "Scanner do balcão — TapGo" },
      {
        name: "description",
        content: "Leia o QR Code do voucher pela câmera e registre retiradas parciais com baixa automática de saldo.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Scanner do balcão — TapGo" },
      { property: "og:description", content: "Leitura de vouchers e registro de retiradas no balcão." },
    ],
  }),
  component: ScannerPage,
});

function clearStaffStorage() {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

function ScannerPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const pinFromUrl = search.pin ? String(search.pin).replace(/\D/g, "").slice(0, 6) : undefined;



  const login = useServerFn(staffLogin);
  const lookupStaff = useServerFn(staffGetOrder);
  const pickupStaff = useServerFn(registerPickup);
  const readyStaff = useServerFn(staffSetItemStatus);
  const lookupOwner = useServerFn(ownerFetchVoucher);
  const pickupOwner = useServerFn(ownerRegisterPickup);
  const readyOwner = useServerFn(ownerSetItemStatusByCode);
  const listOwner = useServerFn(ownerListOpenOrders);
  const listStaff = useServerFn(staffListOpenOrders);
  const queryClient = useQueryClient();
  const [openRequest, setOpenRequest] = useState<{ code: string; nonce: number } | null>(null);

  const [mode, setMode] = useState<"loading" | "owner" | "pin" | "login">("loading");
  const [owner, setOwner] = useState<{ name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [session, setSession] = useState<StaffSession | null>(null);
  const bootstrapped = useRef(false);


  const loginMutation = useMutation({
    mutationFn: (value: string) => login({ data: { pin: value } }),
    onSuccess: (data, value) => {
      if (!data) {
        setMode("login");
        toast.error("PIN inválido ou desativado. Confira em Painel > Equipe.");
        return;
      }
      localStorage.setItem(PIN_KEY, value);
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      setPin(value);
      setSession(data);
      setMode("pin");
      if (pinFromUrl) void navigate({ to: "/scanner", search: {}, replace: true });
      toast.success(`Olá, ${data.name}`);
    },
    onError: (error: Error) => {
      setMode("login");
      toast.error(error.message || "Não foi possível validar o PIN");
    },
  });

  // Decide o modo: dono logado entra direto; senão revalida o PIN salvo/do link.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let active = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;

      if (auth.user) {
        clearStaffStorage();
        const { data: rows } = await supabase.from("establishments").select("name").order("created_at").limit(1);
        if (!active) return;
        setOwner({ name: rows?.[0]?.name ?? "seu estabelecimento" });
        setMode("owner");
        return;
      }

      const urlPin = pinFromUrl;

      if (urlPin && urlPin.length >= 4) {
        loginMutation.mutate(urlPin);
        return;
      }


      const savedPin = localStorage.getItem(PIN_KEY);
      if (!savedPin) {
        setMode("login");
        return;
      }
      const revalidated = await login({ data: { pin: savedPin } });
      if (!active) return;
      if (!revalidated) {
        clearStaffStorage();
        setMode("login");
        toast.error("Sua sessão do balcão expirou. Informe o PIN novamente.");
        return;
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(revalidated));
      setPin(savedPin);
      setSession(revalidated);
      setMode("pin");
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Abrindo o balcão…
      </div>
    );
  }

  if (mode === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-6">
        <form
          className="w-full max-w-sm rounded-3xl border bg-background p-8"
          onSubmit={(event) => {
            event.preventDefault();
            loginMutation.mutate(pinInput);
          }}
        >
          <ScanLine className="size-7 text-primary" aria-hidden />
          <h1 className="mt-5 text-2xl font-semibold">Balcão do atendente</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta tela é só para quem trabalha no balcão. Você não precisa de conta nem senha: use o PIN do seu
            estande, entregue pelo dono do estabelecimento.
          </p>

          <div className="mt-6">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              className="mt-1 text-center text-2xl tracking-[0.4em]"
              required
            />
          </div>
          <Button type="submit" className="mt-5 h-12 w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Validando…" : "Entrar"}
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            O PIN é emitido pela conta do estabelecimento em Painel &gt; Equipe.
          </p>
          <Button asChild variant="link" className="mt-2 w-full text-xs">
            <Link to="/auth">Sou o dono — entrar com login</Link>
          </Button>
        </form>
      </div>
    );
  }

  const isOwner = mode === "owner";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold">
              Tap<span className="text-primary">Go</span> · Balcão
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              {isOwner ? (
                <>
                  <ShieldCheck className="size-3.5 text-success" aria-hidden />
                  Dono · {owner?.name} · acesso a todos os estandes
                </>
              ) : (
                <>
                  {session?.establishment}
                  {session?.station ? ` · ${session.station}` : ""}
                  {session?.event ? ` · ${session.event}` : ""} · {session?.name} ·{" "}
                  {STAFF_ROLE_LABEL[session?.role ?? "scanner"] ?? session?.role}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOwner ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin">Voltar ao painel</Link>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearStaffStorage();
                  setSession(null);
                  setPin("");
                  setPinInput("");
                  setMode("login");
                }}
              >
                <LogOut className="mr-2 size-4" />
                Trocar balcão
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-xl font-semibold">Leitor de voucher</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A câmera fica pausada enquanto um pedido está aberto. Cada voucher tem um código único.
        </p>
        <div className="mt-6 space-y-6">
          {isOwner ? (
            <>
              <OrderQueue
                scope="owner"
                onList={() => listOwner()}
                onSetItemStatus={(code, itemId, status) => readyOwner({ data: { code, itemId, status } })}
                onOpenOrder={(code) => setOpenRequest({ code, nonce: Date.now() })}
              />
              <PickupConsole
                onLookup={(code) => lookupOwner({ data: { code } })}
                onRegister={(code, items) => pickupOwner({ data: { code, items } })}
                onMarkReady={(code, itemId) => readyOwner({ data: { code, itemId, status: "pronto" } })}
                openRequest={openRequest}
                onChanged={() => void queryClient.invalidateQueries({ queryKey: ["order-queue", "owner"] })}
              />
            </>
          ) : (
            <>
              <OrderQueue
                scope={`pin:${pin}`}
                onList={() => listStaff({ data: { pin } })}
                onSetItemStatus={(code, itemId, status) => readyStaff({ data: { pin, code, itemId, status } })}
                onOpenOrder={(code) => setOpenRequest({ code, nonce: Date.now() })}
              />
              <PickupConsole
                onLookup={(code) => lookupStaff({ data: { pin, code } })}
                onRegister={async (code, items) => {
                  const voucher = await pickupStaff({ data: { pin, code, items } });
                  return { voucher, error: voucher ? null : "Não foi possível registrar a retirada" };
                }}
                onMarkReady={(code, itemId) => readyStaff({ data: { pin, code, itemId, status: "pronto" } })}
                openRequest={openRequest}
                onChanged={() => void queryClient.invalidateQueries({ queryKey: ["order-queue", `pin:${pin}`] })}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
