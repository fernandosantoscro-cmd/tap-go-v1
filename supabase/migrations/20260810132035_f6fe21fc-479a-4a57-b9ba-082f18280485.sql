ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS station text;

ALTER TABLE public.pickups
  ADD COLUMN IF NOT EXISTS station text;

CREATE OR REPLACE FUNCTION public.staff_login(p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_staff public.staff;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE pin = p_pin AND active LIMIT 1;
  IF v_staff.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', v_staff.id, 'name', v_staff.name, 'role', v_staff.role,
    'establishment_id', v_staff.establishment_id,
    'station', v_staff.station,
    'event_id', v_staff.event_id,
    'event', (SELECT ev.name FROM public.events ev WHERE ev.id = v_staff.event_id),
    'establishment', (SELECT e.name FROM public.establishments e WHERE e.id = v_staff.establishment_id));
END; $function$;

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
    IF v_item.delivered_quantity + v_qty > v_item.quantity THEN
      RAISE EXCEPTION 'Quantidade acima do saldo disponível de %', v_item.product_name;
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