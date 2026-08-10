-- 1) order_pings: remove public table-wide read access
DROP POLICY IF EXISTS "Avisos visiveis por codigo do pedido" ON public.order_pings;
REVOKE ALL ON public.order_pings FROM anon, authenticated;
GRANT ALL ON public.order_pings TO service_role;

-- Secure accessor: only returns pings for a caller that already knows the exact order code
CREATE OR REPLACE FUNCTION public.get_order_pings(p_code text, p_since timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'item_name', p.item_name, 'status', p.status, 'created_at', p.created_at
  ) ORDER BY p.created_at), '[]'::jsonb)
  FROM public.order_pings p
  WHERE p.order_code = lower(p_code)
    AND length(coalesce(p_code, '')) >= 6
    AND (p_since IS NULL OR p.created_at > p_since);
$$;

REVOKE ALL ON FUNCTION public.get_order_pings(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_pings(text, timestamptz) TO anon, authenticated, service_role;

-- 2) Internal helpers: not callable through the API at all
REVOKE ALL ON FUNCTION public.gen_public_code(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gen_unique_staff_pin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owns_establishment(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Owner-only functions: signed-in users only
REVOKE ALL ON FUNCTION public.ensure_my_establishment(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_set_order_status(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.regenerate_menu_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.establishment_open_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_establishment(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_set_order_status(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_menu_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.establishment_open_state(uuid) TO authenticated;

-- 4) Public menu/counter functions: only through the controlled public (anon) path
REVOKE ALL ON FUNCTION public.get_menu_by_code(text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.create_order(text, jsonb, text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.confirm_payment(text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.staff_login(text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.staff_get_order(text, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.staff_set_status(text, text, text, uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.staff_open_orders(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.get_menu_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_order(text, jsonb, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_payment(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.staff_login(text) TO anon;
GRANT EXECUTE ON FUNCTION public.staff_get_order(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.staff_set_status(text, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.staff_open_orders(text) TO anon;

-- 5) Voucher/pickup functions stay reachable for both public code holders and the owner panel
REVOKE ALL ON FUNCTION public.get_voucher(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_pickup(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_voucher(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_pickup(text, text, jsonb) TO anon, authenticated;
