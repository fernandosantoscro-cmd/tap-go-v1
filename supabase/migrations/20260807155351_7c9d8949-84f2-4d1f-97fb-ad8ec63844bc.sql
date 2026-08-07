REVOKE ALL ON FUNCTION public.ensure_my_establishment(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_set_order_status(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_establishment(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_set_order_status(uuid, text, uuid) TO authenticated, service_role;