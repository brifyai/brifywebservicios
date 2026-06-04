BEGIN;

CREATE OR REPLACE FUNCTION public.grant_abogados_extension(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_extension_id_text text;
  v_plan_id uuid;
BEGIN
  SELECT e.id
  INTO v_extension_id_text
  FROM public.extensiones e
  WHERE lower(coalesce(e.name_es, '')) = 'abogados'
     OR lower(coalesce(e.name, '')) = 'abogados'
  LIMIT 1;

  IF v_extension_id_text IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(
    (SELECT p.id FROM public.plans p WHERE lower(coalesce(p.plan_code, '')) = 'basico' ORDER BY p.id ASC LIMIT 1),
    (SELECT u.current_plan_id FROM public.users u WHERE u.id = p_user_id),
    (SELECT p.id FROM public.plans p ORDER BY COALESCE(p.price, 0) ASC, p.id ASC LIMIT 1)
  )
  INTO v_plan_id
  ;

  IF v_plan_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.plan_extensiones pe
    WHERE pe.user_id = p_user_id
      AND pe.extension_id::text = v_extension_id_text
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.plan_extensiones (user_id, plan_id, extension_id, created_at)
  VALUES (p_user_id, v_plan_id, v_extension_id_text, timezone('utc'::text, now()))
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_grant_abogados_on_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.grant_abogados_extension(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_abogados_on_auth_user_created ON auth.users;

CREATE TRIGGER trg_grant_abogados_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.trg_grant_abogados_on_auth_user_created();

SELECT public.grant_abogados_extension(u.id)
FROM auth.users u;

COMMIT;
