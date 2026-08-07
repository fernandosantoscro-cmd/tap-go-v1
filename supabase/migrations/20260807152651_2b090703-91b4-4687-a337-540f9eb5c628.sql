-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.gen_public_code(p_len int DEFAULT 8)
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (floor(random()*31)+1)::int, 1), '')
  FROM generate_series(1, p_len);
$$;

-- ============ establishments ============
CREATE TABLE public.establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  document text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishments TO authenticated;
GRANT ALL ON public.establishments TO service_role;
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages establishment" ON public.establishments FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER establishments_updated BEFORE UPDATE ON public.establishments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.owns_establishment(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = p_id AND e.owner_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.owns_establishment(uuid) TO authenticated;

-- ============ staff ============
CREATE TYPE public.staff_role AS ENUM ('administrador','atendente','cozinha','bartender','scanner');

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  role public.staff_role NOT NULL DEFAULT 'atendente',
  pin text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages staff" ON public.staff FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));
CREATE TRIGGER staff_updated BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ events ============
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  logo_url text,
  image_url text,
  event_date date,
  start_time time,
  end_time time,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages events" ON public.events FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));
CREATE TRIGGER events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ menus ============
CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE DEFAULT public.gen_public_code(6),
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  available_from time,
  available_to time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menus TO authenticated;
GRANT ALL ON public.menus TO service_role;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages menus" ON public.menus FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));
CREATE TRIGGER menus_updated BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ categories ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages categories" ON public.categories FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));

-- ============ products ============
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  image_url text,
  emoji text,
  price_cents int NOT NULL CHECK (price_cents >= 0),
  prep_minutes int NOT NULL DEFAULT 0,
  requires_prep boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  stock int,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages products" ON public.products FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ orders ============
CREATE TYPE public.order_status AS ENUM ('aguardando_pagamento','recebido','preparando','pronto','entregue','cancelado');
CREATE TYPE public.payment_status AS ENUM ('pendente','pago','falhou','estornado');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT public.gen_public_code(10),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  menu_id uuid REFERENCES public.menus(id) ON DELETE SET NULL,
  customer_id uuid,
  customer_name text,
  status public.order_status NOT NULL DEFAULT 'aguardando_pagamento',
  total_cents int NOT NULL DEFAULT 0,
  payment_method text,
  payment_status public.payment_status NOT NULL DEFAULT 'pendente',
  payment_reference text,
  paid_at timestamptz,
  first_pickup_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages orders" ON public.orders FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX orders_est_created_idx ON public.orders (establishment_id, created_at DESC);

-- ============ order_items ============
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  emoji text,
  unit_price_cents int NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  delivered_quantity int NOT NULL DEFAULT 0 CHECK (delivered_quantity >= 0),
  prep_minutes int NOT NULL DEFAULT 0,
  requires_prep boolean NOT NULL DEFAULT false,
  status public.order_status NOT NULL DEFAULT 'recebido',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivered_not_above_quantity CHECK (delivered_quantity <= quantity)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages order items" ON public.order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.owns_establishment(o.establishment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.owns_establishment(o.establishment_id)));
CREATE TRIGGER order_items_updated BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX order_items_order_idx ON public.order_items (order_id);

-- ============ pickups ============
CREATE TABLE public.pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name text,
  menu_id uuid REFERENCES public.menus(id) ON DELETE SET NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickups TO authenticated;
GRANT ALL ON public.pickups TO service_role;
ALTER TABLE public.pickups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages pickups" ON public.pickups FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));
CREATE INDEX pickups_est_created_idx ON public.pickups (establishment_id, created_at DESC);

-- ============ payment_methods ============
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  method text NOT NULL,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  coming_soon boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, method)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages payment methods" ON public.payment_methods FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));

-- ============ settings ============
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages settings" ON public.settings FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));

-- ============ logs ============
CREATE TABLE public.logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  type text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads logs" ON public.logs FOR SELECT TO authenticated
  USING (public.owns_establishment(establishment_id));
CREATE INDEX logs_est_created_idx ON public.logs (establishment_id, created_at DESC);

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'in_app',
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads notifications" ON public.notifications FOR SELECT TO authenticated
  USING (public.owns_establishment(establishment_id));
CREATE POLICY "owner updates notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (public.owns_establishment(establishment_id)) WITH CHECK (public.owns_establishment(establishment_id));

-- ============ demo data ============
INSERT INTO public.establishments (id, name, slug, document)
VALUES ('11111111-1111-4111-8111-111111111111', 'Arena Live Club', 'arena-live-club', '12.345.678/0001-90');

INSERT INTO public.staff (establishment_id, name, role, pin) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Marina (Gerente)', 'administrador', '1234'),
  ('11111111-1111-4111-8111-111111111111', 'Rafa (Bar Principal)', 'bartender', '2222'),
  ('11111111-1111-4111-8111-111111111111', 'Lucas (Cozinha)', 'cozinha', '3333');

INSERT INTO public.events (id, establishment_id, name, description, event_date, start_time, end_time, location, active)
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
  'Festival Sunset 2026', 'Festival de música eletrônica com 3 palcos e área gastronômica.',
  CURRENT_DATE, '18:00', '04:00', 'Arena Live Club - São Paulo, SP', true);

INSERT INTO public.menus (id, establishment_id, event_id, name, code, sort_order) VALUES
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Bar Principal', 'bar01', 1),
  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Área VIP', 'vip01', 2);

INSERT INTO public.categories (id, establishment_id, menu_id, name, sort_order) VALUES
  ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', 'Chopps e Cervejas', 1),
  ('44444444-4444-4444-8444-444444444442', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', 'Drinks', 2),
  ('44444444-4444-4444-8444-444444444443', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', 'Sem álcool', 3),
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', 'Para comer', 4),
  ('44444444-4444-4444-8444-444444444445', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333332', 'Espumantes', 1),
  ('44444444-4444-4444-8444-444444444446', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333332', 'Drinks autorais', 2);

INSERT INTO public.products (establishment_id, menu_id, category_id, name, description, emoji, price_cents, prep_minutes, requires_prep, sort_order) VALUES
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444441','Chopp Pilsen 300ml','Puro malte, bem gelado.','🍺',1400,0,false,1),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444441','Chopp IPA 300ml','Amargor médio, aroma cítrico.','🍺',1800,0,false,2),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444441','Long Neck','Cerveja lager 355ml.','🍾',1200,0,false,3),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444442','Caipirinha de Limão','Cachaça, limão e gelo.','🍹',2200,2,false,4),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444442','Gin Tônica','Gin, tônica e zestes.','🍸',2600,2,false,5),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444443','Água mineral 500ml','Com ou sem gás.','🥤',600,0,false,6),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444443','Energético','Lata 250ml.','⚡',1400,0,false,7),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444443','Refrigerante','Lata 350ml.','🥤',800,0,false,8),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444444','Batata Frita','Porção com cheddar e bacon.','🍟',2900,12,true,9),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444444','Hot Dog Artesanal','Pão brioche e molho da casa.','🌭',2400,10,true,10),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333331','44444444-4444-4444-8444-444444444444','Porção de Nuggets','8 unidades com molho.','🍗',2100,9,true,11),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333332','44444444-4444-4444-8444-444444444445','Espumante Brut (taça)','Taça 150ml.','🥂',3200,0,false,1),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333332','44444444-4444-4444-8444-444444444445','Champagne (garrafa)','750ml servida no gelo.','🍾',48000,0,false,2),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333332','44444444-4444-4444-8444-444444444446','Negroni','Gin, campari e vermute.','🍸',3400,3,false,3),
  ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333332','44444444-4444-4444-8444-444444444446','Espresso Martini','Vodka, café e licor.','🍸',3600,4,false,4);

INSERT INTO public.payment_methods (establishment_id, method, label, enabled, coming_soon, sort_order) VALUES
  ('11111111-1111-4111-8111-111111111111','pix','PIX',true,false,1),
  ('11111111-1111-4111-8111-111111111111','card','Cartão de crédito',true,false,2),
  ('11111111-1111-4111-8111-111111111111','apple_pay','Apple Pay',false,true,3),
  ('11111111-1111-4111-8111-111111111111','google_pay','Google Pay',false,true,4);