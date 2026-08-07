-- PIN único entre funcionários ativos (evita login no estabelecimento errado)
CREATE UNIQUE INDEX IF NOT EXISTS staff_active_pin_unique ON public.staff (pin) WHERE active;

CREATE OR REPLACE FUNCTION public.gen_unique_staff_pin()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_pin text;
BEGIN
  FOR i IN 1..50 LOOP
    v_pin := lpad((floor(random()*9000)+1000)::int::text, 4, '0');
    IF NOT EXISTS (SELECT 1 FROM public.staff WHERE pin = v_pin AND active) THEN
      RETURN v_pin;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Não foi possível gerar um PIN único';
END; $$;

REVOKE ALL ON FUNCTION public.gen_unique_staff_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gen_unique_staff_pin() TO authenticated, service_role;

-- Cria equipe padrão para estabelecimentos que ainda não têm nenhuma
INSERT INTO public.staff (establishment_id, name, role, pin, active)
SELECT e.id, 'Balcão', 'administrador'::public.staff_role, public.gen_unique_staff_pin(), true
FROM public.establishments e
WHERE NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.establishment_id = e.id);

CREATE OR REPLACE FUNCTION public.ensure_my_establishment(p_name text DEFAULT NULL::text, p_document text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF NOT EXISTS (SELECT 1 FROM public.staff s WHERE s.establishment_id = v_est.id) THEN
      INSERT INTO public.staff (establishment_id, name, role, pin, active)
      VALUES (v_est.id, 'Balcão', 'administrador', public.gen_unique_staff_pin(), true);
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

  INSERT INTO public.staff (establishment_id, name, role, pin, active)
  VALUES (v_est.id, 'Balcão', 'administrador', public.gen_unique_staff_pin(), true);

  RETURN to_jsonb(v_est);
END; $function$;

-- Mensagem clara quando o voucher pertence a outro estabelecimento
CREATE OR REPLACE FUNCTION public.staff_get_order(p_pin text, p_order_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_staff public.staff; v_order public.orders;
BEGIN
  SELECT * INTO v_staff FROM public.staff WHERE pin = p_pin AND active LIMIT 1;
  IF v_staff.id IS NULL THEN RAISE EXCEPTION 'PIN inválido'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE lower(code) = lower(p_order_code) LIMIT 1;
  IF v_order.id IS NULL THEN RETURN NULL; END IF;
  IF v_order.establishment_id <> v_staff.establishment_id THEN
    RAISE EXCEPTION 'Este voucher pertence a outro estabelecimento';
  END IF;

  RETURN public.get_voucher(v_order.code);
END; $function$;