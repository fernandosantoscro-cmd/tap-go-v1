import { Pencil } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface EditableProduct {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  price_cents: number;
  prep_minutes: number;
  stock: number | null;
  category_id: string | null;
}

export interface ProductEditDialogProps {
  product: EditableProduct;
  categories: { id: string; name: string }[];
  onSave: (values: Record<string, unknown>) => Promise<void> | void;
  pending?: boolean;
}

/** Edita nome, preço, descrição, emoji, preparo, estoque e categoria de um produto. */
export function ProductEditDialog({ product, categories, onSave, pending }: ProductEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    emoji: product.emoji ?? "",
    price: (product.price_cents / 100).toFixed(2).replace(".", ","),
    prep_minutes: String(product.prep_minutes ?? 0),
    stock: product.stock === null ? "" : String(product.stock),
    category_id: product.category_id ?? "",
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const cents = Math.round(Number(form.price.replace(/\./g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error("Informe um preço válido");
      return;
    }
    const prep = Number(form.prep_minutes) || 0;
    await onSave({
      name: form.name.trim(),
      description: form.description.trim() || null,
      emoji: form.emoji.trim() || null,
      price_cents: cents,
      prep_minutes: prep,
      requires_prep: prep > 0,
      stock: form.stock === "" ? null : Number(form.stock),
      category_id: form.category_id || null,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Editar ${product.name}`}>
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar produto</DialogTitle>
          <DialogDescription>As mudanças aparecem no cardápio do cliente na hora.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="e-name">Nome</Label>
            <Input
              id="e-name"
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="e-price">Preço (R$)</Label>
            <Input
              id="e-price"
              className="mt-1"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="e-emoji">Emoji</Label>
            <Input
              id="e-emoji"
              className="mt-1"
              maxLength={4}
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="e-prep">Preparo (min)</Label>
            <Input
              id="e-prep"
              className="mt-1"
              inputMode="numeric"
              value={form.prep_minutes}
              onChange={(e) => setForm({ ...form, prep_minutes: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="e-stock">Estoque (vazio = ilimitado)</Label>
            <Input
              id="e-stock"
              className="mt-1"
              inputMode="numeric"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="e-category">Categoria</Label>
            <select
              id="e-category"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="e-desc">Descrição</Label>
            <Textarea
              id="e-desc"
              className="mt-1"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
