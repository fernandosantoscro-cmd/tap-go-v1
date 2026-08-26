import { useMutation } from "@tanstack/react-query";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ClientTabBar } from "@/components/client-tabbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { isValidCpf, maskCpf, onlyDigits } from "@/lib/cpf";
import { formatBRL } from "@/lib/format";
import { rememberMenuCode, rememberOrder } from "@/lib/my-orders";
import { createOrder, fetchMenu } from "@/lib/tapgo.functions";
import type { MenuPayload, MenuProduct } from "@/lib/tapgo-types";
import { cn } from "@/lib/utils";



export const Route = createFileRoute("/menu/$code")({
  loader: async ({ params }) => {
    const menu = await fetchMenu({ data: { code: params.code } });
    if (!menu) throw notFound();
    return menu;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Cardápio indisponível — TapGo" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.menu.name} — ${loaderData.establishment.name}`;
    const description = `Peça e pague pelo celular no ${loaderData.menu.name}. Retire com um único QR Code, sem fila.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  errorComponent: () => <MenuUnavailable title="Não foi possível abrir o cardápio" />,
  notFoundComponent: () => <MenuUnavailable title="Cardápio não encontrado" />,
  component: MenuPage,
});

function MenuUnavailable({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Confira o QR Code do balcão ou peça ajuda a um funcionário.
        </p>
      </div>
    </div>
  );
}

function MenuPage() {
  const menu = Route.useLoaderData() as MenuPayload;

  const navigate = useNavigate();
  const submitOrder = useServerFn(createOrder);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [customerName, setCustomerName] = useState("");
  const [cpf, setCpf] = useState("");

  useEffect(() => rememberMenuCode(menu.menu.code), [menu.menu.code]);

  const cpfOk = isValidCpf(cpf);


  const visibleCategories = useMemo(
    () =>
      activeCategory === "all"
        ? menu.categories
        : menu.categories.filter((category) => category.id === activeCategory),
    [menu.categories, activeCategory],
  );

  const products = useMemo(
    () => menu.categories.flatMap((category) => category.products ?? []),
    [menu.categories],
  );

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => ({
          product: products.find((item) => item.id === productId),
          quantity,
        }))
        .filter((line): line is { product: MenuProduct; quantity: number } => Boolean(line.product)),
    [cart, products],
  );

  const total = lines.reduce((sum, line) => sum + line.product.price_cents * line.quantity, 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  const mutation = useMutation({
    mutationFn: () =>
      submitOrder({
        data: {
          menuCode: menu.menu.code,
          paymentMethod: method,
          customerName: customerName.trim() || null,
          customerDocument: onlyDigits(cpf),
          items: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
        },
      }),
    onSuccess: (order) => {
      rememberOrder({
        code: order.code,
        establishment: menu.establishment.name,
        total_cents: order.total_cents,
        created_at: new Date().toISOString(),
      });
      void navigate({ to: "/pagamento/$code", params: { code: order.code } });
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível criar o pedido"),
  });


  const change = (productId: string, delta: number) =>
    setCart((current) => {
      const next = (current[productId] ?? 0) + delta;
      const copy = { ...current };
      if (next <= 0) delete copy[productId];
      else copy[productId] = Math.min(99, next);
      return copy;
    });

  const openState = menu.open_state ?? null;
  const closed = openState ? !openState.open : false;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="border-b bg-secondary/50">
        <div className="mx-auto max-w-xl px-5 py-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {menu.establishment.name}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{menu.menu.name}</h1>
          {menu.event && (
            <p className="mt-2 text-sm text-muted-foreground">
              {menu.event.name}
              {menu.event.location ? ` · ${menu.event.location}` : ""}
            </p>
          )}
          {openState && (
            <p
              className={cn(
                "mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                closed ? "bg-destructive/10 text-destructive" : "bg-success/15 text-success",
              )}
            >
              <span className="size-2 rounded-full bg-current" aria-hidden />
              {closed ? "Fechado agora" : "Aberto agora"}
              {openState.local_time ? ` · ${openState.local_time}` : ""}
            </p>
          )}
        </div>
      </header>

      {closed && (
        <div className="mx-auto max-w-xl px-5 pt-5">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="font-medium text-destructive">Não estamos aceitando pedidos agora</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {openState?.closed_message ??
                (openState?.reopen_at
                  ? `Voltamos a atender às ${openState.reopen_at}.`
                  : "Confira o horário de funcionamento com a equipe do balcão.")}
            </p>
          </div>
        </div>
      )}


      <nav aria-label="Categorias" className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-5 py-3">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            aria-pressed={activeCategory === "all"}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
              activeCategory === "all" ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
            )}
          >
            Todos
          </button>
          {menu.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              aria-pressed={activeCategory === category.id}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition",
                activeCategory === category.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-xl px-5">
        {visibleCategories.map((category) => (
          <section key={category.id} id={`cat-${category.id}`} className="scroll-mt-20 py-8">

            <h2 className="text-lg font-semibold">{category.name}</h2>
            <ul className="mt-4 space-y-3">
              {(category.products ?? []).map((product) => (
                <li
                  key={product.id}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border p-4",
                    !product.available && "opacity-50",
                  )}
                >
                  <span aria-hidden className="text-3xl">
                    {product.emoji ?? "🍸"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{product.name}</p>
                    {product.description && (
                      <p className="whitespace-pre-line text-sm text-muted-foreground">{product.description}</p>
                    )}

                    <p className="mt-1 flex items-center gap-3 text-sm">
                      <span className="font-semibold">{formatBRL(product.price_cents)}</span>
                      {product.requires_prep && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="size-3.5" aria-hidden />
                          {product.prep_minutes} min
                        </span>
                      )}
                    </p>
                  </div>
                  {product.available ? (
                    cart[product.id] ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={`Remover um ${product.name}`}
                          onClick={() => change(product.id, -1)}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold" aria-live="polite">
                          {cart[product.id]}
                        </span>
                        <Button
                          size="icon"
                          aria-label={`Adicionar um ${product.name}`}
                          onClick={() => change(product.id, 1)}
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button className="tap-target" onClick={() => change(product.id, 1)}>
                        Adicionar
                      </Button>
                    )
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">Indisponível</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      {count > 0 && !checkoutOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-xl">
            <Button className="h-14 w-full text-base" onClick={() => setCheckoutOpen(true)}>
              <ShoppingBag className="mr-2 size-5" />
              {count} {count === 1 ? "item" : "itens"} · {formatBRL(total)}
            </Button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/40" role="dialog" aria-label="Resumo do pedido">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-background p-5">
            <div className="mx-auto max-w-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Seu pedido</h2>
                <Button size="icon" variant="ghost" aria-label="Fechar" onClick={() => setCheckoutOpen(false)}>
                  <X className="size-5" />
                </Button>
              </div>

              <ul className="mt-4 space-y-3">
                {lines.map((line) => (
                  <li key={line.product.id} className="flex items-center gap-3">
                    <span aria-hidden className="text-2xl">
                      {line.product.emoji ?? "🍸"}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{line.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {line.quantity} × {formatBRL(line.product.price_cents)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label={`Remover um ${line.product.name}`}
                        onClick={() => change(line.product.id, -1)}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-7 text-center font-semibold">{line.quantity}</span>
                      <Button
                        size="icon"
                        aria-label={`Adicionar um ${line.product.name}`}
                        onClick={() => change(line.product.id, 1)}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <Separator className="my-5" />

              <div className="grid gap-3">
                <div>
                  <label htmlFor="customer-name" className="text-sm font-medium">
                    Nome <span className="text-muted-foreground">(opcional)</span>
                  </label>
                  <Input
                    id="customer-name"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Como quer ser chamado no balcão"
                    className="mt-1 h-12"
                  />
                </div>
                <div>
                  <label htmlFor="customer-cpf" className="text-sm font-medium">
                    CPF <span className="text-primary">*</span>
                  </label>
                  <Input
                    id="customer-cpf"
                    value={cpf}
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(event) => setCpf(maskCpf(event.target.value))}
                    placeholder="000.000.000-00"
                    aria-invalid={cpf.length > 0 && !cpfOk}
                    className="mt-1 h-12"
                  />
                  {cpf.length > 0 && !cpfOk && (
                    <p className="mt-1 text-xs text-destructive">CPF inválido — confira os números.</p>
                  )}
                </div>
              </div>

              <Separator className="my-5" />


              <fieldset>
                <legend className="text-sm font-medium">Forma de pagamento</legend>
                <div className="mt-3 grid gap-2">
                  {(
                    [
                      { id: "pix", label: "PIX", hint: "Aprovação imediata" },
                      { id: "card", label: "Cartão de crédito", hint: "Visa, Master, Elo" },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-xl border p-4",
                        method === option.id && "border-primary bg-primary/10",
                      )}
                    >
                      <span>
                        <span className="block font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.hint}</span>
                      </span>
                      <input
                        type="radio"
                        name="payment"
                        value={option.id}
                        checked={method === option.id}
                        onChange={() => setMethod(option.id)}
                        className="size-4 accent-[var(--primary)]"
                      />
                    </label>
                  ))}
                  {["Apple Pay", "Google Pay"].map((label) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-xl border border-dashed p-4 text-muted-foreground"
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-xs">Em breve</span>
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="mt-6 flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatBRL(total)}</span>
              </div>

              <Button
                className="mt-4 h-14 w-full text-base"
                disabled={mutation.isPending || lines.length === 0 || closed || !cpfOk}
                onClick={() => mutation.mutate()}
              >
                {closed
                  ? "Fechado agora"
                  : !cpfOk
                    ? "Informe seu CPF para continuar"
                    : mutation.isPending
                      ? "Criando pedido…"
                      : "Ir para o pagamento"}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {closed
                  ? openState?.closed_message ?? "Os pedidos reabrem no próximo horário de funcionamento."
                  : "Sem cadastro. O CPF serve para o balcão achar seu pedido caso você fique sem celular."}
              </p>


            </div>
          </div>
        </div>
      )}
      <ClientTabBar menuCode={menu.menu.code} />
    </div>

  );
}
