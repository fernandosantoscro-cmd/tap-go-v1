REVOKE EXECUTE ON FUNCTION public.owns_establishment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_public_code(int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;

-- ===== cardápio público por código =====
CREATE OR REPLACE FUNCTION public.get_menu_by_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_menu public.menus; v_result jsonb;
BEGIN
  SELECT * INTO v_menu FROM public.menus WHERE lower(code) = lower(p_code) AND active LIMIT 1;
  IF v_menu.id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'menu', jsonb_build_object('id', v_menu.id, 'name', v_menu.name, 'code', v_menu.code,
      'image_url', v_menu.image_url, 'available_from', v_menu.available_from, 'available_to', v_menu.available_to),
    'establishment', (SELECT jsonb_build_object('id', e.id, 'name', e.name, 'logo_url', e.logo_url)
                      FROM public.establishments e WHERE e.id = v_menu.establishment_id),
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
GRANT EXECUTE ON FUNCTION public.get_menu_by_code(text) TO anon, authenticated;

-- ===== criar pedido =====
CREATE OR REPLACE FUNCTION public.create_order(p_menu_code text, p_items jsonb, p_payment_method text, p_customer_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_menu public.menus; v_order public.orders; v_item jsonb; v_product public.products; v_total int := 0; v_qty int;
BEGIN
  SELECT * INTO v_menu FROM public.menus WHERE lower(code) = lower(p_menu_code) AND active LIMIT 1;
  IF v_menu.id IS NULL THEN RAISE EXCEPTION 'Cardápio não encontrado'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Carrinho vazio'; END IF;

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
GRANT EXECUTE ON FUNCTION public.create_order(text, jsonb, text, text) TO anon, authenticated;

-- ===== confirmar pagamento (simulado) =====
CREATE OR REPLACE FUNCTION public.confirm_payment(p_order_code text, p_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE lower(code) = lower(p_order_code) FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  IF v_order.payment_status <> 'pago' THEN
    UPDATE public.orders SET payment_status = 'pago', status = 'recebido', paid_at = now(),
      payment_reference = COALESCE(p_reference, 'sim_' || substr(md5(random()::text), 1, 12))
      WHERE id = v_order.id;
    INSERT INTO public.logs (establishment_id, order_id, type, message)
    VALUES (v_order.establishment_id, v_order.id, 'payment_confirmed', 'Pagamento confirmado');
    INSERT INTO public.notifications (establishment_id, order_id, type, payload)
    VALUES (v_order.establishment_id, v_order.id, 'new_order', jsonb_build_object('code', v_order.code));
  END IF;
  RETURN jsonb_build_object('code', v_order.code, 'paid', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.confirm_payment(text, text) TO anon, authenticated;

-- ===== voucher público =====
CREATE OR REPLACE FUNCTION public.get_voucher(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE lower(code) = lower(p_code) LIMIT 1;
  IF v_order.id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'order', jsonb_build_object('code', v_order.code, 'status', v_order.status,
      'payment_status', v_order.payment_status, 'payment_method', v_order.payment_method,
      'total_cents', v_order.total_cents, 'created_at', v_order.created_at, 'paid_at', v_order.paid_at,
      'payment_reference', v_order.payment_reference),
    'establishment', (SELECT jsonb_build_object('name', e.name) FROM public.establishments e WHERE e.id = v_order.establishment_id),
    'event', (SELECT jsonb_build_object('name', ev.name, 'location', ev.location) FROM public.events ev WHERE ev.id = v_order.event_id),
    'menu', (SELECT jsonb_build_object('name', m.name) FROM public.menus m WHERE m.id = v_order.menu_id),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.product_name, 'emoji', i.emoji,
        'unit_price_cents', i.unit_price_cents, 'quantity', i.quantity, 'delivered_quantity', i.delivered_quantity,
        'available_quantity', i.quantity - i.delivered_quantity, 'prep_minutes', i.prep_minutes,
        'requires_prep', i.requires_prep, 'status', i.status) ORDER BY i.created_at)
      FROM public.order_items i WHERE i.order_id = v_order.id), '[]'::jsonb)
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_voucher(text) TO anon, authenticated;

-- ===== login de funcionário por PIN =====
CREATE OR REPLACE FUNCTION public.staff_login(p_pin text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_staff public.staff;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE pin = p_pin AND active LIMIT 1;
  IF v_staff.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', v_staff.id, 'name', v_staff.name, 'role', v_staff.role,
    'establishment', (SELECT e.name FROM public.establishments e WHERE e.id = v_staff.establishment_id));
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_login(text) TO anon, authenticated;

-- ===== pedido visto pelo balcão (exige PIN) =====
CREATE OR REPLACE FUNCTION public.staff_get_order(p_pin text, p_order_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_staff public.staff; v_order public.orders;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE pin = p_pin AND active LIMIT 1;
  IF v_staff.id IS NULL THEN RAISE EXCEPTION 'PIN inválido'; END IF;
  SELECT * INTO v_order FROM public.orders
    WHERE lower(code) = lower(p_order_code) AND establishment_id = v_staff.establishment_id LIMIT 1;
  IF v_order.id IS NULL THEN RETURN NULL; END IF;
  RETURN public.get_voucher(v_order.code);
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_get_order(text, text) TO anon, authenticated;

-- ===== registrar retirada parcial (atômico) =====
CREATE OR REPLACE FUNCTION public.register_pickup(p_pin text, p_order_code text, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    IF v_item.delivered_quantity + v_qty > v_item.quantity THEN
      RAISE EXCEPTION 'Quantidade acima do saldo disponível de %', v_item.product_name;
    END IF;

    UPDATE public.order_items
      SET delivered_quantity = delivered_quantity + v_qty,
          status = CASE WHEN delivered_quantity + v_qty >= quantity THEN 'entregue'::public.order_status ELSE status END
      WHERE id = v_item.id;

    INSERT INTO public.pickups (establishment_id, order_id, order_item_id, staff_id, staff_name, quantity)
    VALUES (v_order.establishment_id, v_order.id, v_item.id, v_staff.id, v_staff.name, v_qty);
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
    v_staff.name || ' entregou ' || v_count || ' item(ns)', jsonb_build_object('items', p_items));

  RETURN public.get_voucher(v_order.code);
END; $$;
GRANT EXECUTE ON FUNCTION public.register_pickup(text, text, jsonb) TO anon, authenticated;

-- ===== alterar status de preparo =====
CREATE OR REPLACE FUNCTION public.staff_set_status(p_pin text, p_order_code text, p_status text, p_item_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_staff public.staff; v_order public.orders; v_status public.order_status;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE pin = p_pin AND active LIMIT 1;
  IF v_staff.id IS NULL THEN RAISE EXCEPTION 'PIN inválido'; END IF;
  IF p_status NOT IN ('recebido','preparando','pronto','entregue') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  v_status := p_status::public.order_status;

  SELECT * INTO v_order FROM public.orders
    WHERE lower(code) = lower(p_order_code) AND establishment_id = v_staff.establishment_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  IF p_item_id IS NOT NULL THEN
    UPDATE public.order_items SET status = v_status WHERE id = p_item_id AND order_id = v_order.id;
  ELSE
    UPDATE public.order_items SET status = v_status WHERE order_id = v_order.id;
    UPDATE public.orders SET status = v_status,
      completed_at = CASE WHEN v_status = 'entregue' THEN now() ELSE completed_at END
      WHERE id = v_order.id;
  END IF;

  INSERT INTO public.logs (establishment_id, order_id, type, message)
  VALUES (v_order.establishment_id, v_order.id, 'status_changed', v_staff.name || ' alterou status para ' || p_status);
  RETURN public.get_voucher(v_order.code);
END; $$;
GRANT EXECUTE ON FUNCTION public.staff_set_status(text, text, text, uuid) TO anon, authenticated;