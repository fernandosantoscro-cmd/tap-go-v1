-- 1. Provisiona estabelecimento do dono logado
CREATE OR REPLACE FUNCTION public.ensure_my_establishment(p_name text DEFAULT NULL, p_document text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_est public.establishments; v_uid uuid := auth.uid(); v_name text; v_slug text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_est FROM public.establishments WHERE owner_id = v_uid ORDER BY created_at LIMIT 1;
  IF v_est.id IS NOT NULL THEN
    IF p_name IS NOT NULL AND length(trim(p_name)) > 1 AND v_est.name <> p_name THEN
      UPDATE public.establishments SET name = trim(p_name),
        document = COALESCE(NULLIF(trim(COALESCE(p_document,'')),''), document)
        WHERE id = v_est.id RETURNING * INTO v_est;
    END IF;
    RETURN to_jsonb(v_est);
  END IF;

  v_name := COALESCE(NULLIF(trim(COALESCE(p_name,'')),''), 'Meu estabelecimento');
  v_slug := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g') || '-' || public.gen_public_code(5);

  INSERT INTO public.establishments (owner_id, name, slug, document)
  VALUES (v_uid, v_name, v_slug, NULLIF(trim(COALESCE(p_document,'')),''))
  RETURNING * INTO v_est;

  INSERT INTO public.payment_methods (establishment_id, method, label, enabled, coming_soon, sort_order)
  VALUES (v_est.id, 'pix', 'PIX', true, false, 0),
         (v_est.id, 'card', 'Cartão de crédito', true, false, 1),
         (v_est.id, 'cash', 'Dinheiro no caixa', false, true, 2);

  RETURN to_jsonb(v_est);
END; $$;

GRANT EXECUTE ON FUNCTION public.ensure_my_establishment(text, text) TO authenticated;

-- 2. Dono altera status do pedido (com log)
CREATE OR REPLACE FUNCTION public.owner_set_order_status(p_order_id uuid, p_status text, p_item_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_order public.orders; v_status public.order_status;
BEGIN
  IF p_status NOT IN ('recebido','preparando','pronto','entregue','cancelado') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  v_status := p_status::public.order_status;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF NOT public.owns_establishment(v_order.establishment_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  IF p_item_id IS NOT NULL THEN
    UPDATE public.order_items SET status = v_status WHERE id = p_item_id AND order_id = v_order.id;
  ELSE
    UPDATE public.order_items SET status = v_status WHERE order_id = v_order.id;
    UPDATE public.orders SET status = v_status,
      completed_at = CASE WHEN v_status = 'entregue' THEN now() ELSE completed_at END
      WHERE id = v_order.id;
  END IF;

  INSERT INTO public.logs (establishment_id, order_id, type, message)
  VALUES (v_order.establishment_id, v_order.id, 'status_changed', 'Painel alterou status para ' || p_status);

  RETURN public.get_voucher(v_order.code);
END; $$;

GRANT EXECUTE ON FUNCTION public.owner_set_order_status(uuid, text, uuid) TO authenticated;

-- 3. PIN único
CREATE UNIQUE INDEX IF NOT EXISTS staff_pin_unique ON public.staff (pin);

-- 4. Realtime
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;