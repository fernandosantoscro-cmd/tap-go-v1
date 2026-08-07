import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCategories, useMenu, useProducts, useTableMutation } from "@/lib/admin-db";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/cardapios/$menuId")({
  component: MenuDetail,
});

function MenuDetail() {
  const { menuId } = Route.useParams();
  const menu = useMenu(menuId);
  const categories = useCategories(menuId);
  const products = useProducts(menuId);
  const categoryMutation = useTableMutation("categories", ["categories"]);
  const productMutation = useTableMutation("products", ["products"]);

  const [categoryName, setCategoryName] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    emoji: "🍸",
    price: "",
    prep_minutes: "0",
    stock: "",
    category_id: "",
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = menu.data ? `${origin}/menu/${menu.data.code}` : "";

  function addCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!menu.data) return;
    categoryMutation.mutate(
      {
        type: "insert",
        values: { establishment_id: menu.data.establishment_id, menu_id: menuId, name: categoryName },
      },
      {
        onSuccess: () => {
          setCategoryName("");
          toast.success("Categoria criada");
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  function addProduct(event: React.FormEvent) {
    event.preventDefault();
    if (!menu.data) return;
    const cents = Math.round(Number(form.price.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error("Informe um preço válido");
      return;
    }
    productMutation.mutate(
      {
        type: "insert",
        values: {
          establishment_id: menu.data.establishment_id,
          menu_id: menuId,
          category_id: form.category_id || (categories.data?.[0]?.id ?? null),
          name: form.name,
          description: form.description || null,
          emoji: form.emoji || null,
          price_cents: cents,
          prep_minutes: Number(form.prep_minutes) || 0,
          requires_prep: (Number(form.prep_minutes) || 0) > 0,
          stock: form.stock === "" ? null : Number(form.stock),
        },
      },
      {
        onSuccess: () => {
          toast.success("Produto adicionado");
          setForm({ ...form, name: "", description: "", price: "", stock: "" });
        },
        onError: (error: Error) => toast.error(error.message),
      },
    );
  }

  function downloadQr() {
    const img = document.querySelector<HTMLImageElement>("#menu-qr img");
    if (!img) return;
    const link = document.createElement("a");
    link.href = img.src;
    link.download = `qr-${menu.data?.code ?? "cardapio"}.png`;
    link.click();
  }

  if (!menu.data) return <p className="text-sm text-muted-foreground">Carregando cardápio…</p>;

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/admin/cardapios">
            <ArrowLeft className="mr-2 size-4" /> Cardápios
          </Link>
        </Button>
        <h1 className="mt-3 text-3xl font-semibold">{menu.data.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Código público: <span className="font-display tracking-[0.2em]">{menu.data.code.toUpperCase()}</span>
        </p>
      </div>

      <section className="grid gap-6 rounded-2xl border bg-background p-6 lg:grid-cols-[auto_1fr]">
        <div id="menu-qr" className="flex flex-col items-center gap-3">
          <QrCode value={url} size={260} title={`QR Code do cardápio ${menu.data.name}`} />
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadQr}>
              <Download className="mr-2 size-4" /> Baixar QR
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={regenerate.isPending}
              onClick={() => {
                if (!window.confirm("Gerar um novo código? Os QR Codes impressos antigos deixarão de funcionar.")) return;
                regenerate.mutate(menuId, {
                  onSuccess: () => toast.success("Novo código gerado — imprima o QR atualizado"),
                  onError: (error: Error) => toast.error(error.message),
                });
              }}
            >
              <RefreshCcw className="mr-2 size-4" /> Novo código
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Escaneie com o celular</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Aponte a câmera do celular para este QR Code: o cardápio abre no navegador, o cliente escolhe, paga e recebe
            o voucher de retirada.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-secondary px-3 py-2 text-xs">{url}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success("Link copiado");
              }}
            >
              Copiar
            </Button>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <Switch
              checked={menu.data.active}
              onCheckedChange={(checked) =>
                void (async () => {
                  const { supabase } = await import("@/integrations/supabase/client");
                  await supabase.from("menus").update({ active: checked }).eq("id", menuId);
                  void menu.refetch();
                })()
              }
            />
            Cardápio ativo
          </label>
        </div>
      </section>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="text-xl font-semibold">Categorias</h2>
        <form onSubmit={addCategory} className="mt-4 flex flex-wrap gap-2">
          <Input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Drinks, Cervejas, Comidas…"
            className="max-w-xs"
            required
            aria-label="Nome da categoria"
          />
          <Button type="submit" variant="outline">
            <Plus className="mr-2 size-4" /> Adicionar
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {(categories.data ?? []).map((category) => (
            <span key={category.id} className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
              {category.name}
              <button
                type="button"
                aria-label={`Excluir ${category.name}`}
                onClick={() => categoryMutation.mutate({ type: "delete", id: category.id })}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          ))}
          {(categories.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Crie ao menos uma categoria antes dos produtos.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="text-xl font-semibold">Produtos</h2>
        <form onSubmit={addProduct} className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="p-name">Nome</Label>
            <Input
              id="p-name"
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="p-price">Preço (R$)</Label>
            <Input
              id="p-price"
              className="mt-1"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="24,90"
              required
            />
          </div>
          <div>
            <Label htmlFor="p-emoji">Emoji</Label>
            <Input
              id="p-emoji"
              className="mt-1"
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              maxLength={4}
            />
          </div>
          <div>
            <Label htmlFor="p-category">Categoria</Label>
            <select
              id="p-category"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">Primeira categoria</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="p-prep">Preparo (min)</Label>
            <Input
              id="p-prep"
              className="mt-1"
              inputMode="numeric"
              value={form.prep_minutes}
              onChange={(e) => setForm({ ...form, prep_minutes: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="p-stock">Estoque (vazio = ilimitado)</Label>
            <Input
              id="p-stock"
              className="mt-1"
              inputMode="numeric"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="p-desc">Descrição</Label>
            <Textarea
              id="p-desc"
              className="mt-1"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={productMutation.isPending}>
              <Plus className="mr-2 size-4" /> Adicionar produto
            </Button>
          </div>
        </form>

        <div className="mt-6 divide-y rounded-xl border">
          {(products.data ?? []).map((product) => (
            <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {product.emoji ?? "🍸"}
                </span>
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(product.price_cents)} ·{" "}
                    {product.stock === null ? "estoque ilimitado" : `${product.stock} em estoque`}
                    {product.prep_minutes > 0 ? ` · ${product.prep_minutes} min` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={product.available}
                    onCheckedChange={(checked) =>
                      productMutation.mutate({ type: "update", id: product.id, values: { available: checked } })
                    }
                  />
                  Disponível
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Excluir ${product.name}`}
                  onClick={() => productMutation.mutate({ type: "delete", id: product.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {(products.data?.length ?? 0) === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
