import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { SIGNUP_KEY } from "@/lib/admin-db";


export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "login" | "signup" | undefined } => {
    const m = search["mode"];
    return { mode: m === "signup" || m === "login" ? (m as "login" | "signup") : undefined };
  },
  head: () => ({
    meta: [
      { title: "Entrar no painel — TapGo" },
      {
        name: "description",
        content: "Acesse o painel TapGo para cadastrar eventos, cardápios, produtos e acompanhar pedidos em tempo real.",
      },
      { property: "og:title", content: "Entrar no painel — TapGo" },
      { property: "og:description", content: "Painel do estabelecimento TapGo: eventos, cardápios, pedidos e retiradas." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "login");
  const [name, setName] = useState("");
  const [type, setType] = useState("bar");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) void navigate({ to: "/admin", replace: true });
      else setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        void navigate({ to: "/admin", replace: true });
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  function savePending() {
    localStorage.setItem(SIGNUP_KEY, JSON.stringify({ name, type, phone, document }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        savePending();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/admin",
            data: { establishment_name: name },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Confirme seu e-mail para ativar a conta.");
          return;
        }
        toast.success("Conta criada!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível autenticar");
    } finally {
      setLoading(false);
    }
  }


  async function handleGoogle() {
    if (mode === "signup") {
      if (name.trim().length < 2) {
        toast.error("Informe o nome do estabelecimento antes de continuar");
        return;
      }
      savePending();
    }
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error("Não foi possível entrar com o Google");
  }


  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="mx-auto flex max-w-md flex-col px-6 py-10">
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link to="/">
            <ArrowLeft className="mr-2 size-4" /> Voltar
          </Link>
        </Button>

        <div className="mt-6 rounded-3xl border bg-background p-8">
          <span className="font-display text-xl font-semibold">
            Tap<span className="text-primary">Go</span>
          </span>
          <h1 className="mt-5 text-2xl font-semibold">
            {mode === "login" ? "Entrar no painel" : "Criar conta do estabelecimento"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Use seu e-mail e senha ou entre com o Google."
              : "Em segundos você cria seu estabelecimento e gera o QR Code do cardápio."}
          </p>

          <Button variant="outline" className="mt-6 h-12 w-full" onClick={() => void handleGoogle()}>
            Continuar com Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">ou</span>
            <Separator className="flex-1" />
          </div>

          <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="name">Nome do estabelecimento</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Bar do Zé"
                    className="mt-1"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="type">Tipo de negócio</Label>
                    <select
                      id="type"
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="bar">Bar</option>
                      <option value="festival">Festival</option>
                      <option value="arena">Arena / casa de show</option>
                      <option value="beach_club">Beach club</option>
                      <option value="restaurante">Restaurante</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="phone">WhatsApp</Label>
                    <Input
                      id="phone"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-0000"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="document">CNPJ ou CPF (opcional)</Label>
                  <Input
                    id="document"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="mt-1"
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={1}
                className="mt-1"
                required
              />
            </div>
            <Button type="submit" className="h-12" disabled={loading}>
              {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-5 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Não tenho conta ainda" : "Já tenho conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
