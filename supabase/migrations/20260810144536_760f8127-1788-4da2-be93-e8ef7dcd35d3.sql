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
          'available_quantity', i.quantity - i.delivered_quantity,
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

GRANT EXECUTE ON FUNCTION public.staff_open_orders(text) TO anon, authenticated, service_role;