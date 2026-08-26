CREATE OR REPLACE FUNCTION public.gen_establishment_access_code(p_seed text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_prefix text; v_code text;
BEGIN
  v_prefix := upper(regexp_replace(substr(coalesce(nullif(trim(coalesce(p_seed,'')),''), 'tap'), 1, 5), '[^a-zA-Z0-9]', '', 'g'));
  IF coalesce(v_prefix, '') = '' THEN v_prefix := 'TAP'; END IF;
  FOR i IN 1..30 LOOP
    v_code := v_prefix || '-' || upper(public.gen_public_code(4));
    IF NOT EXISTS (
      SELECT 1 FROM public.establishments e WHERE upper(e.access_code) = upper(v_code)
    ) THEN
      RETURN v_code;
    END IF;
  END LOOP;
  RETURN v_prefix || '-' || upper(public.gen_public_code(8));
END; $$;

REVOKE ALL ON FUNCTION public.gen_establishment_access_code(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.establishments
  ALTER COLUMN access_code SET DEFAULT public.gen_establishment_access_code(NULL);

CREATE OR REPLACE FUNCTION public.ensure_my_establishment(p_name text DEFAULT NULL::text, p_document text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_phone text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_est public.establishments; v_uid uuid := auth.uid(); v_name text; v_slug text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_est FROM public.establishments WHERE owner_id = v_uid ORDER BY created_at LIMIT 1;
  IF v_est.id IS NOT NULL THEN
    IF (p_name IS NOT NULL AND length(trim(p_name)) > 1 AND v_est.name <> p_name)
       OR p_document IS NOT NULL OR p_type IS NOT NULL OR p_phone IS NOT NULL THEN
      UPDATE public.establishments SET
        name = CASE WHEN p_name IS NOT NULL AND length(trim(p_name)) > 1 THEN trim(p_name) ELSE name END,
        document = COALESCE(NULLIF(trim(COALESCE(p_document,'')),''), document),
        type = COALESCE(NULLIF(trim(COALESCE(p_type,'')),''), type),
        phone = COALESCE(NULLIF(trim(COALESCE(p_phone,'')),''), phone)
        WHERE id = v_est.id RETURNING * INTO v_est;
    END IF;
    IF coalesce(v_est.access_code, '') = '' THEN
      UPDATE public.establishments
        SET access_code = public.gen_establishment_access_code(v_est.name)
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

  INSERT INTO public.establishments (owner_id, name, slug, document, type, phone, access_code)
  VALUES (v_uid, v_name, v_slug, NULLIF(trim(COALESCE(p_document,'')),''),
          NULLIF(trim(COALESCE(p_type,'')),''), NULLIF(trim(COALESCE(p_phone,'')),''),
          public.gen_establishment_access_code(v_name))
  RETURNING * INTO v_est;

  INSERT INTO public.payment_methods (establishment_id, method, label, enabled, coming_soon, sort_order)
  VALUES (v_est.id, 'pix', 'PIX', true, false, 0),
         (v_est.id, 'card', 'Cartão de crédito', true, false, 1),
         (v_est.id, 'cash', 'Dinheiro no caixa', false, true, 2);

  INSERT INTO public.staff (establishment_id, name, role, pin, active)
  VALUES (v_est.id, 'Balcão', 'administrador', public.gen_unique_staff_pin(), true);

  RETURN to_jsonb(v_est);
END; $$;

REVOKE ALL ON FUNCTION public.ensure_my_establishment(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_establishment(text, text, text, text) TO authenticated;