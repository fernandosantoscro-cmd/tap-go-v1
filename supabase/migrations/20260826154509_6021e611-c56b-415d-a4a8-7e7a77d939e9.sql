-- 1) Código de acesso do estabelecimento
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS access_code text;

UPDATE public.establishments
SET access_code = upper(regexp_replace(substr(coalesce(nullif(slug,''), name, 'tap'), 1, 5), '[^a-zA-Z0-9]', '', 'g')) || '-' || upper(public.gen_public_code(4))
WHERE access_code IS NULL;

ALTER TABLE public.establishments ALTER COLUMN access_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS establishments_access_code_key ON public.establishments (upper(access_code));

-- 2) CPF do cliente no pedido
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_document text;
CREATE INDEX IF NOT EXISTS orders_customer_document_idx ON public.orders (customer_document);

-- 3) Quantidade pronta por item
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS ready_quantity integer NOT NULL DEFAULT 0;

UPDATE public.order_items
SET ready_quantity = GREATEST(
  delivered_quantity,
  CASE WHEN NOT requires_prep OR status IN ('pronto','entregue') THEN quantity ELSE 0 END
);

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_quantities_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantities_check
  CHECK (delivered_quantity >= 0 AND delivered_quantity <= ready_quantity AND ready_quantity <= quantity);

-- 4) Avisos com quantidade
ALTER TABLE public.order_pings ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.notify_order_item_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_code text; v_status text; v_qty int;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.delivered_quantity IS DISTINCT FROM OLD.delivered_quantity
     OR NEW.ready_quantity IS DISTINCT FROM OLD.ready_quantity THEN
    SELECT o.code INTO v_code FROM public.orders o WHERE o.id = NEW.order_id;
    IF v_code IS NOT NULL THEN
      IF NEW.delivered_quantity >= NEW.quantity THEN
        v_status := 'entregue';
        v_qty := NEW.quantity;
      ELSIF NEW.ready_quantity > NEW.delivered_quantity
        AND NEW.ready_quantity IS DISTINCT FROM OLD.ready_quantity THEN
        v_status := 'pronto';
        v_qty := NEW.ready_quantity - NEW.delivered_quantity;
      ELSE
        v_status := NEW.status::text;
        v_qty := GREATEST(0, NEW.ready_quantity - NEW.delivered_quantity);
      END IF;

      INSERT INTO public.order_pings (order_code, item_name, status, quantity)
      VALUES (lower(v_code), NEW.product_name, v_status, v_qty);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_order_pings(p_code text, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'item_name', p.item_name, 'status', p.status,
    'quantity', p.quantity, 'created_at', p.created_at
  ) ORDER BY p.created_at), '[]'::jsonb)
  FROM public.order_pings p
  WHERE p.order_code = lower(p_code)
    AND length(coalesce(p_code, '')) >= 6
    AND (p_since IS NULL OR p.created_at > p_since);
$function$;

-- 5) Voucher com as quatro quantidades
CREATE OR REPLACE FUNCTION public.get_voucher(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_order public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE lower(code) = lower(p_code) LIMIT 1;
  IF v_order.id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'order', jsonb_build_object('code', v_order.code, 'status', v_order.status,
      'payment_status', v_order.payment_status, 'payment_method', v_order.payment_method,
      'total_cents', v_order.total_cents, 'created_at', v_order.created_at, 'paid_at', v_order.paid_at,
      'customer_name', v_order.customer_name,
      'payment_reference', v_order.payment_reference),
    'establishment', (SELECT jsonb_build_object('name', e.name) FROM public.establishments e WHERE e.id = v_order.establishment_id),
    'event', (SELECT jsonb_build_object('name', ev.name, 'location', ev.location) FROM public.events ev WHERE ev.id = v_order.event_id),
    'menu', (SELECT jsonb_build_object('name', m.name) FROM public.menus m WHERE m.id = v_order.menu_id),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.product_name, 'emoji', i.emoji,
        'unit_price_cents', i.unit_price_cents, 'quantity', i.quantity,
        'ready_quantity', i.ready_quantity,
        'delivered_quantity', i.delivered_quantity,
        'available_quantity', GREATEST(0, i.ready_quantity - i.delivered_quantity),
        'preparing_quantity', GREATEST(0, i.quantity - i.ready_quantity),
        'remaining_quantity', GREATEST(0, i.quantity - i.delivered_quantity),
        'prep_minutes', i.prep_minutes,
        'requires_prep', i.requires_prep, 'status', i.status) ORDER BY i.created_at)
      FROM public.order_items i WHERE i.order_id = v_order.id), '[]'::jsonb)
  );
END; $function$;

-- 6) Criação do pedido com CPF e itens sem preparo já prontos
CREATE OR REPLACE FUNCTION public.create_order(p_menu_code text, p_items jsonb, p_payment_method text, p_customer_name text DEFAULT NULL::text, p_customer_document text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_menu public.menus; v_order public.orders; v_item jsonb; v_product public.products; v_total int := 0; v_qty int; v_state jsonb; v_doc text;
BEGIN
  SELECT * INTO v_menu FROM public.menus WHERE lower(code) = lower(p_menu_code) AND active LIMIT 1;
  IF v_menu.id IS NULL THEN RAISE EXCEPTION 'Cardápio não encontrado'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Carrinho vazio'; END IF;

  v_doc := regexp_replace(coalesce(p_customer_document, ''), '[^0-9]', '', 'g');
  IF length(v_doc) <> 11 THEN RAISE EXCEPTION 'Informe um CPF válido para continuar'; END IF;

  v_state := public.establishment_open_state(v_menu.establishment_id);
  IF NOT COALESCE((v_state->>'open')::boolean, false) THEN
    RAISE EXCEPTION '%', COALESCE(NULLIF(v_state->>'closed_message',''), 'Estabelecimento fechado no momento. Tente novamente mais tarde.');
  END IF;

  INSERT INTO public.orders (establishment_id, event_id, menu_id, payment_method, customer_name, customer_document)
  VALUES (v_menu.establishment_id, v_menu.event_id, v_menu.id, p_payment_method, p_customer_name, v_doc)
  RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(1, LEAST(99, COALESCE((v_item->>'quantity')::int, 1)));
    SELECT * INTO v_product FROM public.products
      WHERE id = (v_item->>'product_id')::uuid AND menu_id = v_menu.id AND available;
    IF v_product.id IS NULL THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
    IF v_product.stock IS NOT NULL AND v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para %', v_product.name;
    END IF;

    INSERT INTO public.order_items (order_id, product_id, product_name, emoji, unit_price_cents, quantity, prep_minutes, requires_prep, ready_quantity)
    VALUES (v_order.id, v_product.id, v_product.name, v_product.emoji, v_product.price_cents, v_qty, v_product.prep_minutes, v_product.requires_prep,
      CASE WHEN v_product.requires_prep THEN 0 ELSE v_qty END);

    IF v_product.stock IS NOT NULL THEN
      UPDATE public.products SET stock = stock - v_qty WHERE id = v_product.id;
    END IF;
    v_total := v_total + (v_product.price_cents * v_qty);
  END LOOP;

  UPDATE public.orders SET total_cents = v_total WHERE id = v_order.id;
  INSERT INTO public.logs (establishment_id, order_id, type, message)
  VALUES (v_menu.establishment_id, v_order.id, 'order_created', 'Pedido criado pelo cardápio ' || v_menu.name);

  RETURN jsonb_build_object('code', v_order.code, 'total_cents', v_total);
END; $function$;

-- 7) Login do funcionário por código do estabelecimento + PIN
CREATE OR REPLACE FUNCTION public.staff_login_by_code(p_code text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_est public.establishments; v_staff public.staff;
BEGIN
  SELECT * INTO v_est FROM public.establishments
    WHERE upper(regexp_replace(access_code, '[^a-zA-Z0-9]', '', 'g')) = upper(regexp_replace(coalesce(p_code,''), '[^a-zA-Z0-9]', '', 'g'))
    LIMIT 1;
  IF v_est.id IS NULL THEN RAISE EXCEPTION 'Código do estabelecimento não encontrado'; END IF;

  SELECT * INTO v_staff FROM public.staff
    WHERE pin = p_pin AND active AND establishment_id = v_est.id LIMIT 1;
  IF v_staff.id IS NULL THEN RAISE EXCEPTION 'PIN inválido para este estabelecimento'; END IF;

  RETURN jsonb_build_object('id', v_staff.id, 'name', v_staff.name, 'role', v_staff.role,
    'pin', v_staff.pin,
    'establishment_id', v_staff.establishment_id,
    'station', v_staff.station,
    'event_id', v_staff.event_id,
    'event', (SELECT ev.name FROM public.events ev WHERE ev.id = v_staff.event_id),
    'establishment', v_est.name);
END; $function$;

-- 8) Liberar quantidade pronta (funcionário)
CREATE OR REPLACE FUNCTION public.staff_set_ready_quantity(p_pin text, p_order_code text, p_item_id uuid, p_quantity integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_staff public.staff; v_order public.orders; v_item public.order_items; v_target int;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE pin = p_pin AND active LIMIT 1;
  IF v_staff.id IS NULL THEN RAISE EXCEPTION 'PIN inválido'; END IF;

  SELECT * INTO v_order FROM public.orders
    WHERE lower(code) = lower(p_order_code) AND establishment_id = v_staff.establishment_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_item_id AND order_id = v_order.id FOR UPDATE;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado no pedido'; END IF;

  v_target := LEAST(v_item.quantity, GREATEST(v_item.delivered_quantity, COALESCE(p_quantity, 0)));

  UPDATE public.order_items
    SET ready_quantity = v_target,
        status = CASE
          WHEN delivered_quantity >= quantity THEN 'entregue'::public.order_status
          WHEN v_target > delivered_quantity THEN 'pronto'::public.order_status
          ELSE 'preparando'::public.order_status END
    WHERE id = v_item.id;

  UPDATE public.orders SET status = 'preparando' WHERE id = v_order.id AND status = 'recebido';

  INSERT INTO public.logs (establishment_id, order_id, type, message)
  VALUES (v_order.establishment_id, v_order.id, 'ready_quantity',
    v_staff.name || ' liberou ' || v_target || ' de ' || v_item.quantity || ' · ' || v_item.product_name);

  RETURN public.get_voucher(v_order.code);
END; $function$;

-- 9) Liberar quantidade pronta (painel do dono)
CREATE OR REPLACE FUNCTION public.owner_set_ready_quantity(p_order_id uuid, p_item_id uuid, p_quantity integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_order public.orders; v_item public.order_items; v_target int;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF NOT public.owns_establishment(v_order.establishment_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_item_id AND order_id = v_order.id FOR UPDATE;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado no pedido'; END IF;

  v_target := LEAST(v_item.quantity, GREATEST(v_item.delivered_quantity, COALESCE(p_quantity, 0)));

  UPDATE public.order_items
    SET ready_quantity = v_target,
        status = CASE
          WHEN delivered_quantity >= quantity THEN 'entregue'::public.order_status
          WHEN v_target > delivered_quantity THEN 'pronto'::public.order_status
          ELSE 'preparando'::public.order_status END
    WHERE id = v_item.id;

  UPDATE public.orders SET status = 'preparando' WHERE id = v_order.id AND status = 'recebido';

  INSERT INTO public.logs (establishment_id, order_id, type, message)
  VALUES (v_order.establishment_id, v_order.id, 'ready_quantity',
    'Painel liberou ' || v_target || ' de ' || v_item.quantity || ' · ' || v_item.product_name);

  RETURN public.get_voucher(v_order.code);
END; $function$;

-- 10) Retirada validando contra a quantidade liberada
CREATE OR REPLACE FUNCTION public.register_pickup(p_pin text, p_order_code text, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_staff public.staff; v_order public.orders; v_entry jsonb; v_item public.order_items; v_qty int; v_count int := 0; v_pending int;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE pin = p_pin AND active LIMIT 1;
  IF v_staff.id IS NULL THEN RAISE EXCEPTION 'PIN inválido'; END IF;

  SELECT * INTO v_order FROM public.orders
    WHERE lower(code) = lower(p_order_code) AND establishment_id = v_staff.establishment_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_order.payment_status <> 'pago' THEN RAISE EXCEPTION 'Pedido não está pago'; END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_entry->>'quantity')::int, 0);
    CONTINUE WHEN v_qty <= 0;
    SELECT * INTO v_item FROM public.order_items
      WHERE id = (v_entry->>'item_id')::uuid AND order_id = v_order.id FOR UPDATE;
    IF v_item.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado no pedido'; END IF;
    IF v_item.delivered_quantity + v_qty > v_item.ready_quantity THEN
      RAISE EXCEPTION 'Só % unidade(s) de % está(ão) liberada(s) para retirada', GREATEST(0, v_item.ready_quantity - v_item.delivered_quantity), v_item.product_name;
    END IF;

    UPDATE public.order_items
      SET delivered_quantity = delivered_quantity + v_qty,
          status = CASE WHEN delivered_quantity + v_qty >= quantity THEN 'entregue'::public.order_status ELSE status END
      WHERE id = v_item.id;

    INSERT INTO public.pickups (establishment_id, order_id, order_item_id, staff_id, staff_name, menu_id, station, quantity)
    VALUES (v_order.establishment_id, v_order.id, v_item.id, v_staff.id, v_staff.name, v_order.menu_id, v_staff.station, v_qty);
    v_count := v_count + v_qty;
  END LOOP;

  IF v_count = 0 THEN RAISE EXCEPTION 'Nenhuma quantidade informada'; END IF;

  IF v_order.first_pickup_at IS NULL THEN
    UPDATE public.orders SET first_pickup_at = now() WHERE id = v_order.id;
  END IF;

  SELECT COUNT(*) INTO v_pending FROM public.order_items
    WHERE order_id = v_order.id AND delivered_quantity < quantity;
  IF v_pending = 0 THEN
    UPDATE public.orders SET status = 'entregue', completed_at = now() WHERE id = v_order.id;
  ELSE
    UPDATE public.orders SET status = 'preparando' WHERE id = v_order.id AND status = 'recebido';
  END IF;

  INSERT INTO public.logs (establishment_id, order_id, type, message, metadata)
  VALUES (v_order.establishment_id, v_order.id, 'pickup',
    v_staff.name || ' entregou ' || v_count || ' item(ns)', jsonb_build_object('items', p_items, 'station', v_staff.station));

  RETURN public.get_voucher(v_order.code);
END; $function$;

-- 11) Fila do balcão com as quantidades
CREATE OR REPLACE FUNCTION public.staff_open_orders(p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_staff public.staff; v_result jsonb;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE pin = p_pin AND active LIMIT 1;
  IF v_staff.id IS NULL THEN RAISE EXCEPTION 'PIN inválido'; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.paid_at), '[]'::jsonb) INTO v_result
  FROM (
    SELECT o.code, o.status::text AS status, o.total_cents, o.paid_at, o.created_at,
      o.customer_name,
      (SELECT m.name FROM public.menus m WHERE m.id = o.menu_id) AS menu_name,
      (SELECT ev.name FROM public.events ev WHERE ev.id = o.event_id) AS event_name,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.product_name, 'emoji', i.emoji,
          'quantity', i.quantity, 'delivered_quantity', i.delivered_quantity,
          'ready_quantity', i.ready_quantity,
          'available_quantity', GREATEST(0, i.ready_quantity - i.delivered_quantity),
          'preparing_quantity', GREATEST(0, i.quantity - i.ready_quantity),
          'remaining_quantity', GREATEST(0, i.quantity - i.delivered_quantity),
          'unit_price_cents', i.unit_price_cents,
          'prep_minutes', i.prep_minutes, 'requires_prep', i.requires_prep,
          'status', i.status) ORDER BY i.created_at)
        FROM public.order_items i WHERE i.order_id = o.id
      ), '[]'::jsonb) AS items
    FROM public.orders o
    WHERE o.establishment_id = v_staff.establishment_id
      AND o.payment_status = 'pago'
      AND o.status <> 'cancelado'
      AND EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = o.id AND i.delivered_quantity < i.quantity)
      AND (v_staff.event_id IS NULL OR o.event_id = v_staff.event_id)
    ORDER BY o.paid_at
    LIMIT 100
  ) t;

  RETURN v_result;
END; $function$;

-- 12) Busca de pedidos ativos por CPF
CREATE OR REPLACE FUNCTION public.staff_find_orders_by_document(p_pin text, p_document text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_staff public.staff; v_doc text; v_result jsonb;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE pin = p_pin AND active LIMIT 1;
  IF v_staff.id IS NULL THEN RAISE EXCEPTION 'PIN inválido'; END IF;

  v_doc := regexp_replace(coalesce(p_document,''), '[^0-9]', '', 'g');
  IF length(v_doc) <> 11 THEN RAISE EXCEPTION 'Informe o CPF completo'; END IF;

  SELECT COALESCE(jsonb_agg(public.get_voucher(o.code) ORDER BY o.paid_at DESC), '[]'::jsonb) INTO v_result
  FROM public.orders o
  WHERE o.establishment_id = v_staff.establishment_id
    AND o.customer_document = v_doc
    AND o.payment_status = 'pago'
    AND o.status <> 'cancelado'
    AND EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = o.id AND i.delivered_quantity < i.quantity);

  RETURN v_result;
END; $function$;

CREATE OR REPLACE FUNCTION public.owner_find_orders_by_document(p_establishment_id uuid, p_document text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc text; v_result jsonb;
BEGIN
  IF NOT public.owns_establishment(p_establishment_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  v_doc := regexp_replace(coalesce(p_document,''), '[^0-9]', '', 'g');
  IF length(v_doc) <> 11 THEN RAISE EXCEPTION 'Informe o CPF completo'; END IF;

  SELECT COALESCE(jsonb_agg(public.get_voucher(o.code) ORDER BY o.paid_at DESC), '[]'::jsonb) INTO v_result
  FROM public.orders o
  WHERE o.establishment_id = p_establishment_id
    AND o.customer_document = v_doc
    AND o.payment_status = 'pago'
    AND o.status <> 'cancelado'
    AND EXISTS (SELECT 1 FROM public.order_items i WHERE i.order_id = o.id AND i.delivered_quantity < i.quantity);

  RETURN v_result;
END; $function$;

-- 13) Permissões
REVOKE ALL ON FUNCTION public.create_order(text, jsonb, text, text) FROM anon, authenticated;
DROP FUNCTION IF EXISTS public.create_order(text, jsonb, text, text);

REVOKE ALL ON FUNCTION public.create_order(text, jsonb, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_order(text, jsonb, text, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.staff_login_by_code(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_login_by_code(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.staff_set_ready_quantity(text, text, uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_set_ready_quantity(text, text, uuid, integer) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.owner_set_ready_quantity(uuid, uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_set_ready_quantity(uuid, uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.staff_find_orders_by_document(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.staff_find_orders_by_document(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.owner_find_orders_by_document(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_find_orders_by_document(uuid, text) TO authenticated;