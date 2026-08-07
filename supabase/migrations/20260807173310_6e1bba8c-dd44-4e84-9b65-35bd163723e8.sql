ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{"0":{"open":true,"from":"10:00","to":"23:59"},"1":{"open":true,"from":"10:00","to":"23:59"},"2":{"open":true,"from":"10:00","to":"23:59"},"3":{"open":true,"from":"10:00","to":"23:59"},"4":{"open":true,"from":"10:00","to":"23:59"},"5":{"open":true,"from":"10:00","to":"23:59"},"6":{"open":true,"from":"10:00","to":"23:59"}}'::jsonb,
  ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS closed_message text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.establishment_open_state(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_est public.establishments;
  v_local timestamp;
  v_dow int;
  v_day jsonb;
  v_from time;
  v_to time;
  v_open boolean := false;
  v_reopen text := null;
  v_i int;
  v_next jsonb;
BEGIN
  SELECT * INTO v_est FROM public.establishments WHERE id = p_id;
  IF v_est.id IS NULL THEN RETURN jsonb_build_object('open', false, 'reason', 'not_found'); END IF;

  v_local := (now() AT TIME ZONE COALESCE(NULLIF(v_est.timezone, ''), 'America/Sao_Paulo'));
  v_dow := EXTRACT(DOW FROM v_local)::int;
  v_day := v_est.business_hours -> v_dow::text;

  IF v_day IS NOT NULL AND COALESCE((v_day->>'open')::boolean, false) THEN
    v_from := COALESCE(NULLIF(v_day->>'from',''), '00:00')::time;
    v_to := COALESCE(NULLIF(v_day->>'to',''), '23:59')::time;
    IF v_from <= v_to THEN
      v_open := v_local::time BETWEEN v_from AND v_to;
    ELSE
      v_open := v_local::time >= v_from OR v_local::time <= v_to;
    END IF;
  END IF;

  IF NOT v_open THEN
    FOR v_i IN 0..7 LOOP
      v_next := v_est.business_hours -> (((v_dow + v_i) % 7))::text;
      IF v_next IS NOT NULL AND COALESCE((v_next->>'open')::boolean, false) THEN
        IF v_i > 0 OR v_local::time < COALESCE(NULLIF(v_next->>'from',''),'00:00')::time THEN
          v_reopen := COALESCE(NULLIF(v_next->>'from',''),'00:00');
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'open', v_open AND v_est.accepting_orders,
    'within_hours', v_open,
    'accepting_orders', v_est.accepting_orders,
    'reopen_at', v_reopen,
    'closed_message', v_est.closed_message,
    'local_time', to_char(v_local, 'HH24:MI')
  );
END; $$;

CREATE OR REPLACE FUNCTION public.get_menu_by_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_menu public.menus; v_result jsonb;
BEGIN
  SELECT * INTO v_menu FROM public.menus WHERE lower(code) = lower(p_code) AND active LIMIT 1;
  IF v_menu.id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'menu', jsonb_build_object('id', v_menu.id, 'name', v_menu.name, 'code', v_menu.code,
      'image_url', v_menu.image_url, 'available_from', v_menu.available_from, 'available_to', v_menu.available_to),
    'establishment', (SELECT jsonb_build_object('id', e.id, 'name', e.name, 'logo_url', e.logo_url, 'type', e.type)
                      FROM public.establishments e WHERE e.id = v_menu.establishment_id),
    'open_state', public.establishment_open_state(v_menu.establishment_id),
    'event', (SELECT jsonb_build_object('id', ev.id, 'name', ev.name, 'description', ev.description,
                'image_url', ev.image_url, 'logo_url', ev.logo_url, 'location', ev.location,
                'event_date', ev.event_date, 'start_time', ev.start_time, 'end_time', ev.end_time, 'active', ev.active)
              FROM public.events ev WHERE ev.id = v_menu.event_id),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'products', COALESCE(p.products, '[]'::jsonb)) ORDER BY c.sort_order, c.name)
      FROM public.categories c
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'description', pr.description,
                 'image_url', pr.image_url, 'emoji', pr.emoji, 'price_cents', pr.price_cents,
                 'prep_minutes', pr.prep_minutes, 'requires_prep', pr.requires_prep,
                 'available', pr.available AND (pr.stock IS NULL OR pr.stock > 0)) ORDER BY pr.sort_order, pr.name) AS products
        FROM public.products pr WHERE pr.category_id = c.id
      ) p ON true
      WHERE c.menu_id = v_menu.id
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.create_order(p_menu_code text, p_items jsonb, p_payment_method text, p_customer_name text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_menu public.menus; v_order public.orders; v_item jsonb; v_product public.products; v_total int := 0; v_qty int; v_state jsonb;
BEGIN
  SELECT * INTO v_menu FROM public.menus WHERE lower(code) = lower(p_menu_code) AND active LIMIT 1;
  IF v_menu.id IS NULL THEN RAISE EXCEPTION 'Cardápio não encontrado'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Carrinho vazio'; END IF;

  v_state := public.establishment_open_state(v_menu.establishment_id);
  IF NOT COALESCE((v_state->>'open')::boolean, false) THEN
    RAISE EXCEPTION '%', COALESCE(NULLIF(v_state->>'closed_message',''), 'Estabelecimento fechado no momento. Tente novamente mais tarde.');
  END IF;

  INSERT INTO public.orders (establishment_id, event_id, menu_id, payment_method, customer_name)
  VALUES (v_menu.establishment_id, v_menu.event_id, v_menu.id, p_payment_method, p_customer_name)
  RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(1, LEAST(99, COALESCE((v_item->>'quantity')::int, 1)));
    SELECT * INTO v_product FROM public.products
      WHERE id = (v_item->>'product_id')::uuid AND menu_id = v_menu.id AND available;
    IF v_product.id IS NULL THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
    IF v_product.stock IS NOT NULL AND v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para %', v_product.name;
    END IF;

    INSERT INTO public.order_items (order_id, product_id, product_name, emoji, unit_price_cents, quantity, prep_minutes, requires_prep)
    VALUES (v_order.id, v_product.id, v_product.name, v_product.emoji, v_product.price_cents, v_qty, v_product.prep_minutes, v_product.requires_prep);

    IF v_product.stock IS NOT NULL THEN
      UPDATE public.products SET stock = stock - v_qty WHERE id = v_product.id;
    END IF;
    v_total := v_total + (v_product.price_cents * v_qty);
  END LOOP;

  UPDATE public.orders SET total_cents = v_total WHERE id = v_order.id;
  INSERT INTO public.logs (establishment_id, order_id, type, message)
  VALUES (v_menu.establishment_id, v_order.id, 'order_created', 'Pedido criado pelo cardápio ' || v_menu.name);

  RETURN jsonb_build_object('code', v_order.code, 'total_cents', v_total);
END; $$;

CREATE OR REPLACE FUNCTION public.ensure_my_establishment(p_name text DEFAULT NULL::text, p_document text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_phone text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_est public.establishments; v_uid uuid := auth.uid(); v_name text; v_slug text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_est FROM public.establishments WHERE owner_id = v_uid ORDER BY created_at LIMIT 1;
  IF v_est.id IS NOT NULL THEN
    IF (p_name IS NOT NULL AND length(trim(p_name)) > 1 AND v_est.name <> p_name)
       OR p_document IS NOT NULL OR p_type IS NOT NULL OR p_phone IS NOT NULL THEN
      UPDATE public.establishments SET
        name = CASE WHEN p_name IS NOT NULL AND length(trim(p_name)) > 1 THEN trim(p_name) ELSE name END,
        document = COALESCE(NULLIF(trim(COALESCE(p_document,'')),''), document),
        type = COALESCE(NULLIF(trim(COALESCE(p_type,'')),''), type),
        phone = COALESCE(NULLIF(trim(COALESCE(p_phone,'')),''), phone)
        WHERE id = v_est.id RETURNING * INTO v_est;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.establishment_id = v_est.id) THEN
      INSERT INTO public.staff (establishment_id, name, role, pin, active)
      VALUES (v_est.id, 'Balcão', 'administrador', public.gen_unique_staff_pin(), true);
    END IF;
    RETURN to_jsonb(v_est);
  END IF;

  v_name := COALESCE(NULLIF(trim(COALESCE(p_name,'')),''), 'Meu estabelecimento');
  v_slug := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g') || '-' || public.gen_public_code(5);

  INSERT INTO public.establishments (owner_id, name, slug, document, type, phone)
  VALUES (v_uid, v_name, v_slug, NULLIF(trim(COALESCE(p_document,'')),''),
          NULLIF(trim(COALESCE(p_type,'')),''), NULLIF(trim(COALESCE(p_phone,'')),''))
  RETURNING * INTO v_est;

  INSERT INTO public.payment_methods (establishment_id, method, label, enabled, coming_soon, sort_order)
  VALUES (v_est.id, 'pix', 'PIX', true, false, 0),
         (v_est.id, 'card', 'Cartão de crédito', true, false, 1),
         (v_est.id, 'cash', 'Dinheiro no caixa', false, true, 2);

  INSERT INTO public.staff (establishment_id, name, role, pin, active)
  VALUES (v_est.id, 'Balcão', 'administrador', public.gen_unique_staff_pin(), true);

  RETURN to_jsonb(v_est);
END; $$;

CREATE OR REPLACE FUNCTION public.regenerate_menu_code(p_menu_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_menu public.menus; v_code text;
BEGIN
  SELECT * INTO v_menu FROM public.menus WHERE id = p_menu_id;
  IF v_menu.id IS NULL THEN RAISE EXCEPTION 'Cardápio não encontrado'; END IF;
  IF NOT public.owns_establishment(v_menu.establishment_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  FOR i IN 1..20 LOOP
    v_code := public.gen_public_code(6);
    IF NOT EXISTS (SELECT 1 FROM public.menus WHERE lower(code) = lower(v_code)) THEN
      UPDATE public.menus SET code = v_code WHERE id = v_menu.id;
      INSERT INTO public.logs (establishment_id, type, message)
      VALUES (v_menu.establishment_id, 'menu_code_regenerated', 'Novo código gerado para ' || v_menu.name);
      RETURN jsonb_build_object('code', v_code);
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Não foi possível gerar um novo código';
END; $$;