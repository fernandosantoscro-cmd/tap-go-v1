import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  QrCode,
  ReceiptText,
  ScanLine,
  Settings,
  Users,

} from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/admin-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { to: "/admin/pedidos", label: "Pedidos", icon: ReceiptText },
  { to: "/admin/retirada", label: "Retirada (scanner)", icon: ScanLine },
  { to: "/admin/eventos", label: "Eventos", icon: CalendarDays },
  { to: "/admin/cardapios", label: "Cardápios & QR", icon: QrCode },
  { to: "/admin/qrcodes", label: "QR Codes dos estandes", icon: QrCode },

  { to: "/admin/equipe", label: "Equipe & pagamentos", icon: Users },
  { to: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const;


function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const establishment = useEstablishment();

  // Aplica o nome escolhido no cadastro na primeira abertura do painel.
  useEffect(() => {
    const pending = localStorage.getItem("tapgo.establishment.name");
    if (!pending || !establishment.data) return;
    localStorage.removeItem("tapgo.establishment.name");
    if (establishment.data.name === pending) return;
    void supabase
      .from("establishments")
      .update({ name: pending })
      .eq("id", establishment.data.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["establishment"] }));
  }, [establishment.data, queryClient]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-secondary/30 lg:flex">
      <aside className="border-b bg-background lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-5 py-5">
          <div className="min-w-0">
            <span className="font-display text-lg font-semibold">
              Tap<span className="text-primary">Go</span>
            </span>
            <p className="truncate text-xs text-muted-foreground">
              {establishment.isLoading ? "Carregando…" : establishment.data?.name}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Sair" onClick={() => void signOut()}>
            <LogOut className="size-4" />
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item ? item.exact : false }}
              className="shrink-0 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
              activeProps={{ className: cn("bg-secondary font-medium text-foreground") }}
            >
              <span className="flex items-center gap-2">
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </span>
            </Link>
          ))}
          <a
            href="/scanner"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            <span className="flex items-center gap-2">
              <ScanLine className="size-4" aria-hidden />
              Scanner em outro aparelho
            </span>
          </a>

        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-8 lg:px-10">
        {establishment.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : establishment.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">Não foi possível carregar seu estabelecimento.</p>
            <Button variant="outline" onClick={() => void establishment.refetch()}>
              Tentar novamente
            </Button>
          </div>

        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
