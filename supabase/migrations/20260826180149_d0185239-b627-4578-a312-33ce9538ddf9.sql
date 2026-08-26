-- Internal trigger function must not be callable through the API
REVOKE ALL ON FUNCTION public.notify_order_item_status() FROM PUBLIC, anon, authenticated;

-- Owner-only functions should never be callable by anonymous visitors
REVOKE ALL ON FUNCTION public.owner_find_orders_by_document(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_set_ready_quantity(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_find_orders_by_document(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_set_ready_quantity(uuid, uuid, integer) TO authenticated;

-- Legacy PIN-only staff login is no longer used by the app
REVOKE ALL ON FUNCTION public.staff_login(text) FROM PUBLIC, anon, authenticated;

-- Explicit owner-scoped SELECT policies so realtime streams stay owner-only
CREATE POLICY "owner reads orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.owns_establishment(establishment_id));

CREATE POLICY "owner reads order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND public.owns_establishment(o.establishment_id)
  ));