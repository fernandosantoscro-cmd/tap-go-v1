import { useState } from "react";
import { Download, Monitor, Smartphone, Share, Plus, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

const PUBLISHED_URL = "https://instant-retire.lovable.app";

export function InstallButton({ className }: { className?: string }) {
  const { platform, canInstall, needsManualSteps, install, installed } = useInstallPrompt();
  const [open, setOpen] = useState(false);

  if (installed) return null;

  const label = platform === "desktop" ? "Instalar no PC" : "Instalar app";

  const handleClick = async () => {
    if (canInstall) {
      const accepted = await install();
      if (!accepted) setOpen(true);
      return;
    }
    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        onClick={handleClick}
        className={`gap-2 bg-primary text-primary-foreground hover:bg-primary/90 ${className ?? ""}`}
      >
        <Download className="size-4" />
        {label}
      </Button>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {platform === "desktop" ? (
              <Monitor className="size-5 text-primary" />
            ) : (
              <Smartphone className="size-5 text-primary" />
            )}
            Instalar o TapGo
          </DialogTitle>
          <DialogDescription>
            {platform === "desktop"
              ? "Abra o painel e o leitor de retirada em uma janela própria, sem abas do navegador."
              : "Acesse mais rápido, em tela cheia, direto do seu celular."}
          </DialogDescription>
        </DialogHeader>

        {canInstall ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Toque abaixo para instalar agora.
            </p>
            <Button className="w-full" onClick={async () => install()}>
              <Download className="mr-2 size-4" />
              Instalar agora
            </Button>
          </div>
        ) : platform === "ios" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No Safari, toque em <Share className="inline size-4 align-text-bottom" />{" "}
              <strong>Compartilhar</strong> e depois em{" "}
              <Plus className="inline size-4 align-text-bottom" />{" "}
              <strong>Adicionar à Tela de Início</strong>.
            </p>
            <a href={PUBLISHED_URL} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full">
                <ExternalLink className="mr-2 size-4" />
                Abrir o TapGo no Safari
              </Button>
            </a>
          </div>
        ) : platform === "desktop" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No Chrome ou Edge, abra o link abaixo e clique no ícone{" "}
              <strong className="inline-flex items-center gap-1">
                <Plus className="size-4" /> Instalar
              </strong>{" "}
              na barra de endereços, ou use o menu <strong>⋮ → Instalar o TapGo</strong>.
            </p>
            <a href={PUBLISHED_URL} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full">
                <ExternalLink className="mr-2 size-4" />
                Abrir o app publicado
              </Button>
            </a>
          </div>
        ) : platform === "android" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No Chrome do Android, abra o link e toque no banner{" "}
              <strong>Instalar</strong> ou use o menu{" "}
              <strong>⋮ → Instalar app</strong>.
            </p>
            <a href={PUBLISHED_URL} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full">
                <ExternalLink className="mr-2 size-4" />
                Abrir o TapGo
              </Button>
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Abra o TapGo em um navegador compatível (Chrome, Edge ou Safari) para instalar.
            </p>
            <a href={PUBLISHED_URL} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full">
                <ExternalLink className="mr-2 size-4" />
                Abrir o app publicado
              </Button>
            </a>
          </div>
        )}

        <p className="flex items-center justify-center gap-1 pt-2 text-xs text-muted-foreground">
          <Check className="size-3" /> Funciona offline depois de instalado
        </p>
      </DialogContent>
    </Dialog>
  );
}
