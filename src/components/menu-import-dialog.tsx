import { useState } from "react";
import { FileDown, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { downloadTemplate, parseMenuFile, type ImportedProduct } from "@/lib/menu-import";

interface Props {
  menuId: string;
  establishmentId: string;
  existingCategories: { id: string; name: string }[];
  onImported: () => void;
}

export function MenuImportDialog({ menuId, establishmentId, existingCategories, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportedProduct[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleFile(file: File) {
    const text = await file.text();
    const result = parseMenuFile(file.name, text);
    setFileName(file.name);
    setRows(result.rows);
    setErrors(result.errors);
    if (result.rows.length === 0) toast.error(result.errors[0] ?? "Nenhum produto encontrado no arquivo");
  }

  async function importRows() {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const categoryMap = new Map(existingCategories.map((category) => [category.name.trim().toLowerCase(), category.id]));

      const missing = Array.from(
        new Set(
          rows
            .map((row) => row.category?.trim())
            .filter((name): name is string => Boolean(name) && !categoryMap.has(name!.toLowerCase())),
        ),
      );

      if (missing.length > 0) {
        const { data, error } = await supabase
          .from("categories")
          .insert(missing.map((name, index) => ({ establishment_id: establishmentId, menu_id: menuId, name, sort_order: existingCategories.length + index })))
          .select("id, name");
        if (error) throw new Error(error.message);
        (data ?? []).forEach((category) => categoryMap.set(category.name.trim().toLowerCase(), category.id));
      }

      const fallbackCategory = existingCategories[0]?.id ?? categoryMap.values().next().value ?? null;

      const { error } = await supabase.from("products").insert(
        rows.map((row, index) => ({
          establishment_id: establishmentId,
          menu_id: menuId,
          category_id: row.category ? (categoryMap.get(row.category.trim().toLowerCase()) ?? fallbackCategory) : fallbackCategory,
          name: row.name,
          description: row.description,
          emoji: row.emoji,
          price_cents: row.price_cents,
          prep_minutes: row.prep_minutes,
          requires_prep: row.prep_minutes > 0,
          stock: row.stock,
          available: row.available,
          sort_order: index,
        })),
      );
      if (error) throw new Error(error.message);

      toast.success(`${rows.length} produto(s) importado(s)`);
      setRows([]);
      setErrors([]);
      setFileName("");
      setOpen(false);
      onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar o cardápio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileUp className="mr-2 size-4" /> Importar CSV/XML
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar cardápio</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV ou XML com os produtos. Categorias novas são criadas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => downloadTemplate("csv")}>
              <FileDown className="mr-2 size-4" /> Modelo CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => downloadTemplate("xml")}>
              <FileDown className="mr-2 size-4" /> Modelo XML
            </Button>
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-secondary/40">
            <Upload className="size-6" />
            <span>{fileName || "Clique para escolher o arquivo (.csv ou .xml)"}</span>
            <input
              type="file"
              accept=".csv,.xml,text/csv,application/xml,text/xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
          </label>

          <p className="text-xs text-muted-foreground">
            Colunas aceitas: nome, categoria, descricao, emoji, preco, preparo_min, estoque, disponivel.
          </p>

          {errors.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {errors.slice(0, 8).map((message) => (
                <li key={message}>{message}</li>
              ))}
              {errors.length > 8 && <li>+{errors.length - 8} outros avisos</li>}
            </ul>
          )}

          {rows.length > 0 && (
            <div className="divide-y rounded-xl border text-sm">
              {rows.slice(0, 30).map((row, index) => (
                <div key={`${row.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{row.emoji ?? "🍸"}</span>
                    <span className="font-medium">{row.name}</span>
                    <span className="text-xs text-muted-foreground">{row.category ?? "sem categoria"}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatBRL(row.price_cents)}
                    {row.prep_minutes > 0 ? ` · ${row.prep_minutes} min` : " · balcão"}
                  </span>
                </div>
              ))}
              {rows.length > 30 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">+{rows.length - 30} produtos…</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => void importRows()} disabled={rows.length === 0 || saving}>
            {saving ? "Importando…" : `Importar ${rows.length || ""} produto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
