import { useEffect, useState } from "react";
import { Download, Monitor, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

export function InstallPrompt() {
  const { platform, canInstall, needsManualSteps, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);
  const [delayDone, setDelayDone] = useState(false);

  const dismissKey = `tapgo.install.dismissed.${platform}`;

  useEffect(() => {
    if (platform === "unsupported") return;
    try {
      setDismissed(localStorage.getItem(dismissKey) === "1");
    } catch {
      setDismissed(false);
    }
    const timer = window.setTimeout(() => setDelayDone(true), platform === "ios" ? 2500 : 1200);
    return () => window.clearTimeout(timer);
  }, [dismissKey, platform]);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      /* ignore */
    }
  };

  const visible = !dismissed && delayDone && (canInstall || needsManualSteps);
  if (!visible) return null;

  const isDesktop = platform === "desktop";

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) dismiss();
  };

  return (
    <div
      className={
        isDesktop
          ? "fixed bottom-6 right-6 z-[60] w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur"
          : "fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur"
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {isDesktop ? <Monitor className="size-5" /> : <Download className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {isDesktop ? "Instalar o TapGo no computador" : "Instalar o TapGo"}
          </p>
          {needsManualSteps ? (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Toque em <Share className="size-3.5" /> Compartilhar e depois em{" "}
              <Plus className="size-3.5" /> Adicionar à Tela de Início.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {isDesktop
                ? "Abra o painel e o leitor de retirada em janela própria, sem abas do navegador."
                : "Acesse mais rápido, em tela cheia, direto do seu celular."}
            </p>
          )}
          {canInstall && (
            <Button size="sm" className="mt-3" onClick={handleInstall}>
              {isDesktop ? "Instalar no computador" : "Instalar app"}
            </Button>
          )}
        </div>
        <button
          type="button"
          aria-label="Fechar"
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
