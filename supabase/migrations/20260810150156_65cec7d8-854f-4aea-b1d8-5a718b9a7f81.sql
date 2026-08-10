CREATE TABLE public.order_pings (
  id uuid primary key default gen_random_uuid(),
  order_code text not null,
  item_name text,
  status text not null,
  created_at timestamptz not null default now()
);

CREATE INDEX order_pings_code_idx ON public.order_pings (lower(order_code), created_at DESC);

GRANT SELECT ON public.order_pings TO anon, authenticated;
GRANT ALL ON public.order_pings TO service_role;

ALTER TABLE public.order_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Avisos visiveis por codigo do pedido"
ON public.order_pings FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.notify_order_item_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.delivered_quantity IS DISTINCT FROM OLD.delivered_quantity THEN
    SELECT o.code INTO v_code FROM public.orders o WHERE o.id = NEW.order_id;
    IF v_code IS NOT NULL THEN
      INSERT INTO public.order_pings (order_code, item_name, status)
      VALUES (lower(v_code), NEW.product_name,
        CASE WHEN NEW.delivered_quantity >= NEW.quantity THEN 'entregue' ELSE NEW.status::text END);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS order_items_status_ping ON public.order_items;
CREATE TRIGGER order_items_status_ping
AFTER UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.notify_order_item_status();

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_pings;