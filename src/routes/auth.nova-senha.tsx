import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/nova-senha")({
  head: () => ({
    meta: [
      { title: "Definir nova senha — TapGo" },
      { name: "description", content: "Escolha uma nova senha para voltar ao painel do seu estabelecimento no TapGo." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Definir nova senha — TapGo" },
      { property: "og:description", content: "Crie uma nova senha de acesso ao painel TapGo." },
    ],
  }),
  component: NewPasswordPage,
});

function NewPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada!");
    void navigate({ to: "/admin", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-6">
      <form
        className="w-full max-w-sm rounded-3xl border bg-background p-8"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <KeyRound className="size-7 text-primary" aria-hidden />
        <h1 className="mt-5 text-2xl font-semibold">Nova senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Abra esta página pelo link enviado no seu e-mail e escolha uma senha com pelo menos 6 caracteres.
        </p>

        <div className="mt-6">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            className="mt-1 h-12"
            required
          />
        </div>
        <Button type="submit" className="mt-5 h-12 w-full" disabled={loading}>
          {loading ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
