
-- 1. Integrações por estabelecimento
CREATE TABLE public.establishment_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  provider text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT false,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_integrations TO authenticated;
GRANT ALL ON public.establishment_integrations TO service_role;
ALTER TABLE public.establishment_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages integrations" ON public.establishment_integrations
  FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id))
  WITH CHECK (public.owns_establishment(establishment_id));
CREATE TRIGGER establishment_integrations_updated BEFORE UPDATE ON public.establishment_integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Documentos fiscais por pedido
CREATE TABLE public.fiscal_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  number text,
  pdf_url text,
  xml_url text,
  provider_ref text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.fiscal_documents TO authenticated;
GRANT ALL ON public.fiscal_documents TO service_role;
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages fiscal documents" ON public.fiscal_documents
  FOR ALL TO authenticated
  USING (public.owns_establishment(establishment_id))
  WITH CHECK (public.owns_establishment(establishment_id));
CREATE TRIGGER fiscal_documents_updated BEFORE UPDATE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Log de eventos de integração
CREATE TABLE public.integration_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  provider text,
  direction text NOT NULL DEFAULT 'outbound',
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads integration events" ON public.integration_events
  FOR SELECT TO authenticated
  USING (public.owns_establishment(establishment_id));

-- 4. Campos novos em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fiscal_status text NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS payment_provider_ref text;

-- 5. Dados fiscais do estabelecimento
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS municipal_registration text,
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS tax_regime text,
  ADD COLUMN IF NOT EXISTS fiscal_address jsonb;

-- 6. Função segura para salvar credenciais (servidor valida dono)
CREATE OR REPLACE FUNCTION public.save_integration(
  p_provider text,
  p_credentials jsonb DEFAULT '{}'::jsonb,
  p_settings jsonb DEFAULT '{}'::jsonb,
  p_enabled boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE v_est public.establishments; v_row public.establishment_integrations;
BEGIN
  SELECT * INTO v_est FROM public.establishments WHERE owner_id = auth.uid() ORDER BY created_at LIMIT 1;
  IF v_est.id IS NULL THEN RAISE EXCEPTION 'Estabelecimento não encontrado'; END IF;

  INSERT INTO public.establishment_integrations (establishment_id, provider, credentials, settings, enabled)
  VALUES (v_est.id, p_provider, COALESCE(p_credentials, '{}'::jsonb), COALESCE(p_settings, '{}'::jsonb), COALESCE(p_enabled, false))
  ON CONFLICT (establishment_id, provider) DO UPDATE SET
    credentials = CASE WHEN p_credentials ? '__keep__' THEN public.establishment_integrations.credentials ELSE EXCLUDED.credentials END,
    settings = EXCLUDED.settings,
    enabled = EXCLUDED.enabled
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('id', v_row.id, 'provider', v_row.provider, 'enabled', v_row.enabled, 'settings', v_row.settings, 'last_status', v_row.last_status, 'last_error', v_row.last_error);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.save_integration(text, jsonb, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_integration(text, jsonb, jsonb, boolean) TO authenticated;

-- 7. Listagem segura de integrações sem expor credenciais
CREATE OR REPLACE FUNCTION public.list_integrations()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE v_est public.establishments;
BEGIN
  SELECT * INTO v_est FROM public.establishments WHERE owner_id = auth.uid() ORDER BY created_at LIMIT 1;
  IF v_est.id IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'provider', i.provider, 'enabled', i.enabled, 'settings', i.settings,
      'last_status', i.last_status, 'last_error', i.last_error,
      'has_credentials', (i.credentials <> '{}'::jsonb)
    ) ORDER BY i.provider)
    FROM public.establishment_integrations i WHERE i.establishment_id = v_est.id
  ), '[]'::jsonb);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.list_integrations() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_integrations() FROM anon;

-- 8. Voucher inclui documento fiscal
CREATE OR REPLACE FUNCTION public.get_voucher(p_code text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
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
      'payment_reference', v_order.payment_reference,
      'fiscal_status', v_order.fiscal_status),
    'establishment', (SELECT jsonb_build_object('name', e.name) FROM public.establishments e WHERE e.id = v_order.establishment_id),
    'event', (SELECT jsonb_build_object('name', ev.name, 'location', ev.location) FROM public.events ev WHERE ev.id = v_order.event_id),
    'menu', (SELECT jsonb_build_object('name', m.name) FROM public.menus m WHERE m.id = v_order.menu_id),
    'fiscal', (SELECT jsonb_build_object('status', f.status, 'number', f.number, 'pdf_url', f.pdf_url)
               FROM public.fiscal_documents f
               WHERE f.order_id = v_order.id AND f.status = 'emitida'
               ORDER BY f.created_at DESC LIMIT 1),
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
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_voucher(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_voucher(text) TO authenticated;
