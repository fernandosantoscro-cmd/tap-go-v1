ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS requested_quantity integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.customer_request_prep(p_order_code text, p_item_id uuid, p_quantity integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_order public.orders; v_item public.order_items; v_target int;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE lower(code) = lower(p_order_code) LIMIT 1;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_order.payment_status <> 'pago' THEN RAISE EXCEPTION 'Pedido ainda não está pago'; END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_item_id AND order_id = v_order.id FOR UPDATE;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'Item não encontrado no pedido'; END IF;

  v_target := LEAST(v_item.quantity, GREATEST(v_item.requested_quantity, COALESCE(p_quantity, 0)));

  UPDATE public.order_items SET requested_quantity = v_target WHERE id = v_item.id;

  INSERT INTO public.logs (establishment_id, order_id, type, message)
  VALUES (v_order.establishment_id, v_order.id, 'prep_request',
    'Cliente pediu preparo de ' || v_target || ' × ' || v_item.product_name);

  INSERT INTO public.notifications (establishment_id, order_id, type, payload)
  VALUES (v_order.establishment_id, v_order.id, 'prep_request',
    jsonb_build_object('item_id', v_item.id, 'item', v_item.product_name, 'quantity', v_target));

  RETURN public.get_voucher(v_order.code);
END; $function$;

REVOKE ALL ON FUNCTION public.customer_request_prep(text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_request_prep(text, uuid, integer) TO anon, authenticated;

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
        'requested_quantity', i.requested_quantity,
        'delivered_quantity', i.delivered_quantity,
        'available_quantity', GREATEST(0, i.ready_quantity - i.delivered_quantity),
        'preparing_quantity', GREATEST(0, i.quantity - i.ready_quantity),
        'remaining_quantity', GREATEST(0, i.quantity - i.delivered_quantity),
        'prep_minutes', i.prep_minutes,
        'requires_prep', i.requires_prep, 'status', i.status) ORDER BY i.created_at)
      FROM public.order_items i WHERE i.order_id = v_order.id), '[]'::jsonb)
  );
END; $function$;

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
          'requested_quantity', i.requested_quantity,
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