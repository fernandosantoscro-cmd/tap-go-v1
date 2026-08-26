import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, FileText, KeyRound, Link2, Loader2, Plug, RefreshCcw, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getIntegrations,
  saveIntegration,
  testIntegration,
  type IntegrationSummary,
} from "@/lib/integrations.functions";

const FISCAL_PROVIDERS = [
  { value: "nfeio", label: "NFE.io" },
  { value: "focusnfe", label: "Focus NFe" },
  { value: "enotas", label: "eNotas" },
] as const;

function generateApiKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `tapgo_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function StatusBadge({ integration }: { integration?: IntegrationSummary | undefined }) {
  if (!integration) return <Badge variant="secondary">Não configurado</Badge>;
  if (!integration.enabled) return <Badge variant="secondary">Desativado</Badge>;
  if (integration.last_status === "erro") return <Badge variant="destructive">Erro</Badge>;
  return <Badge>Ativo</Badge>;
}

export function IntegrationsSettings() {
  const queryClient = useQueryClient();
  const fetchIntegrations = useServerFn(getIntegrations);
  const save = useServerFn(saveIntegration);
  const test = useServerFn(testIntegration);

  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: () => fetchIntegrations(),
  });

  const byProvider = new Map((integrations.data ?? []).map((row) => [row.provider, row]));
  const mp = byProvider.get("mercadopago");
  const fiscal = byProvider.get("fiscal");
  const webhook = byProvider.get("webhook_custom");

  // Mercado Pago
  const [mpToken, setMpToken] = useState("");
  const [mpEnabled, setMpEnabled] = useState(false);
  // Fiscal
  const [fiscalProvider, setFiscalProvider] = useState("nfeio");
  const [fiscalKey, setFiscalKey] = useState("");
  const [fiscalCompany, setFiscalCompany] = useState("");
  const [fiscalEnv, setFiscalEnv] = useState("homologacao");
  const [fiscalAuto, setFiscalAuto] = useState(true);
  const [fiscalEnabled, setFiscalEnabled] = useState(false);
  // Webhook / API
  const [hookUrl, setHookUrl] = useState("");
  const [hookKey, setHookKey] = useState("");
  const [hookEnabled, setHookEnabled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMpEnabled(Boolean(mp?.enabled));
  }, [mp?.enabled]);
  useEffect(() => {
    if (!fiscal) return;
    setFiscalEnabled(Boolean(fiscal.enabled));
    setFiscalProvider(String(fiscal.settings?.["fiscal_provider"] ?? "nfeio"));
    setFiscalEnv(String(fiscal.settings?.["ambiente"] ?? "homologacao"));
    setFiscalAuto(fiscal.settings?.["auto_issue"] !== false);
  }, [fiscal]);
  useEffect(() => {
    if (!webhook) return;
    setHookEnabled(Boolean(webhook.enabled));
    setHookUrl(String(webhook.settings?.["url"] ?? ""));
  }, [webhook]);

  const saveMutation = useMutation({
    mutationFn: (payload: {
      provider: string;
      credentials: Record<string, unknown>;
      settings: Record<string, unknown>;
      enabled: boolean;
    }) => save({ data: payload }),
    onSuccess: (_result, payload) => {
      toast.success("Integração salva");
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
      if (payload.provider === "mercadopago") setMpToken("");
      if (payload.provider === "fiscal") {
        setFiscalKey("");
        setFiscalCompany("");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testMutation = useMutation({
    mutationFn: (provider: string) => test({ data: { provider } }),
    onSuccess: (result) =>
      result.ok ? toast.success(result.message) : toast.error(result.message),
    onError: (error: Error) => toast.error(error.message),
  });

  function saveMercadoPago() {
    saveMutation.mutate({
      provider: "mercadopago",
      enabled: mpEnabled,
      credentials: mpToken.trim() ? { access_token: mpToken.trim() } : { __keep__: true },
      settings: {},
    });
  }

  function saveFiscal() {
    saveMutation.mutate({
      provider: "fiscal",
      enabled: fiscalEnabled,
      credentials:
        fiscalKey.trim() || fiscalCompany.trim()
          ? { api_key: fiscalKey.trim(), company_id: fiscalCompany.trim() }
          : { __keep__: true },
      settings: { fiscal_provider: fiscalProvider, ambiente: fiscalEnv, auto_issue: fiscalAuto },
    });
  }

  function saveWebhook() {
    saveMutation.mutate({
      provider: "webhook_custom",
      enabled: hookEnabled,
      credentials: hookKey ? { api_key: hookKey } : { __keep__: true },
      settings: { url: hookUrl.trim() },
    });
  }

  const inputClass = "mt-1";
  const saving = saveMutation.isPending;

  return (
    <section className="rounded-2xl border bg-background p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Plug className="size-5 text-primary" aria-hidden /> Integrações
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Conecte o TapGo às plataformas que o estabelecimento já usa: pagamento real, nota fiscal e
        sistemas de gestão (ERP).
      </p>

      {/* Mercado Pago */}
      <div className="mt-6 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Wallet className="size-4 text-primary" aria-hidden /> Pagamento real — Mercado Pago
          </h3>
          <StatusBadge integration={mp} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          PIX e cartão de verdade. Crie um token em{" "}
          <span className="font-medium">mercadopago.com.br/developers</span> (use o token de teste
          para homologar). Sem token, o pagamento continua simulado.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="mp-token">Access token</Label>
            <Input
              id="mp-token"
              type="password"
              className={inputClass}
              placeholder={mp?.has_credentials ? "•••••••• (salvo — cole para trocar)" : "APP_USR-…"}
              value={mpToken}
              onChange={(e) => setMpToken(e.target.value)}
            />
          </div>
          <div className="flex items-end justify-between gap-4 pb-1">
            <div>
              <p className="text-sm font-medium">Cobrança real ativa</p>
              <p className="text-xs text-muted-foreground">Desligado = modo simulação</p>
            </div>
            <Switch checked={mpEnabled} onCheckedChange={setMpEnabled} aria-label="Ativar Mercado Pago" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={saveMercadoPago} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate("mercadopago")}
          >
            <RefreshCcw className="mr-2 size-4" /> Testar conexão
          </Button>
        </div>
        {mp?.last_error && <p className="mt-2 text-xs text-destructive">{mp.last_error}</p>}
      </div>

      {/* Fiscal */}
      <div className="mt-4 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <FileText className="size-4 text-primary" aria-hidden /> Nota fiscal automática
          </h3>
          <StatusBadge integration={fiscal} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Emite a nota/cupom assim que o pagamento é confirmado. O PDF aparece no voucher do cliente.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="fiscal-provider">Plataforma fiscal</Label>
            <select
              id="fiscal-provider"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={fiscalProvider}
              onChange={(e) => setFiscalProvider(e.target.value)}
            >
              {FISCAL_PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fiscal-env">Ambiente</Label>
            <select
              id="fiscal-env"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={fiscalEnv}
              onChange={(e) => setFiscalEnv(e.target.value)}
            >
              <option value="homologacao">Homologação (testes)</option>
              <option value="producao">Produção</option>
            </select>
          </div>
          <div>
            <Label htmlFor="fiscal-key">API key / token</Label>
            <Input
              id="fiscal-key"
              type="password"
              className={inputClass}
              placeholder={fiscal?.has_credentials ? "•••••••• (salvo — cole para trocar)" : "Chave da plataforma"}
              value={fiscalKey}
              onChange={(e) => setFiscalKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fiscal-company">ID da empresa {fiscalProvider !== "focusnfe" ? "" : "(opcional)"}</Label>
            <Input
              id="fiscal-company"
              className={inputClass}
              value={fiscalCompany}
              onChange={(e) => setFiscalCompany(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-3">
            <Switch checked={fiscalEnabled} onCheckedChange={setFiscalEnabled} aria-label="Ativar emissão fiscal" />
            <span className="text-sm">Emissão ativa</span>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={fiscalAuto} onCheckedChange={setFiscalAuto} aria-label="Emitir automaticamente" />
            <span className="text-sm">Emitir automaticamente após o pagamento</span>
          </div>
        </div>
        <div className="mt-4">
          <Button size="sm" onClick={saveFiscal} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Salvar
          </Button>
        </div>
        {fiscal?.last_error && <p className="mt-2 text-xs text-destructive">{fiscal.last_error}</p>}
      </div>

      {/* Webhook / API para ERP */}
      <div className="mt-4 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Link2 className="size-4 text-primary" aria-hidden /> Plataforma do estabelecimento (ERP / POS)
          </h3>
          <StatusBadge integration={webhook} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          O TapGo envia eventos (pedido pago, nota emitida) para a URL do seu sistema, com assinatura
          de segurança. A mesma chave libera a API de leitura em{" "}
          <code className="rounded bg-muted px-1 text-xs">/api/public/integrations/orders</code>{" "}
          (header <code className="rounded bg-muted px-1 text-xs">x-api-key</code>).
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="hook-url">URL do webhook</Label>
            <Input
              id="hook-url"
              className={inputClass}
              placeholder="https://seu-sistema.com/webhooks/tapgo"
              value={hookUrl}
              onChange={(e) => setHookUrl(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="hook-key" className="flex items-center gap-1">
              <KeyRound className="size-3.5" aria-hidden /> Chave de API
            </Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="hook-key"
                className="font-mono text-xs"
                placeholder={webhook?.has_credentials ? "•••••••• (salva — gere para trocar)" : "Gere uma chave"}
                value={hookKey}
                onChange={(e) => setHookKey(e.target.value)}
              />
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setHookKey(generateApiKey())}>
                Gerar
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Switch checked={hookEnabled} onCheckedChange={setHookEnabled} aria-label="Ativar webhook" />
          <span className="text-sm">Envio de eventos ativo</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={saveWebhook} disabled={saving}>
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate("webhook_custom")}
          >
            <RefreshCcw className="mr-2 size-4" /> Enviar evento de teste
          </Button>
          {hookKey && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(hookKey);
                setCopied(true);
                toast.success("Chave copiada");
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />} Copiar chave
            </Button>
          )}
        </div>
        {webhook?.last_error && <p className="mt-2 text-xs text-destructive">{webhook.last_error}</p>}
      </div>
    </section>
  );
}
