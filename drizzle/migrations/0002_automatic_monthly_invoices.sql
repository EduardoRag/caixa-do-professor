CREATE OR REPLACE FUNCTION public.generate_current_month_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month date := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _competence text := to_char(_month, 'YYYY-MM');
  _count integer;
BEGIN
  WITH ins AS (
    INSERT INTO public.invoices (teacher_id, student_id, competence, amount_cents, due_date)
    SELECT s.teacher_id, s.id, _competence, s.monthly_amount_cents,
      _month + (s.due_day - 1)::integer
    FROM public.students s
    WHERE s.is_active
    ON CONFLICT (teacher_id, student_id, competence) DO NOTHING
    RETURNING id, teacher_id
  ), aud AS (
    INSERT INTO public.audit_logs (teacher_id, entity, entity_id, action, metadata)
    SELECT teacher_id, 'invoice', id, 'generate',
      jsonb_build_object('competence', _competence, 'automatic', true)
    FROM ins RETURNING 1
  )
  SELECT count(*) INTO _count FROM aud;
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_current_month_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_current_month_invoices() TO service_role;

CREATE OR REPLACE FUNCTION public.student_current_month_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month date := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _competence text := to_char(_month, 'YYYY-MM');
  _invoice_id uuid;
BEGIN
  IF NOT NEW.is_active THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> NEW.teacher_id THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  INSERT INTO public.invoices (teacher_id, student_id, competence, amount_cents, due_date)
  VALUES (NEW.teacher_id, NEW.id, _competence, NEW.monthly_amount_cents,
    _month + (NEW.due_day - 1)::integer)
  ON CONFLICT (teacher_id, student_id, competence) DO NOTHING
  RETURNING id INTO _invoice_id;
  IF _invoice_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (teacher_id, entity, entity_id, action, metadata)
    VALUES (NEW.teacher_id, 'invoice', _invoice_id, 'generate',
      jsonb_build_object('competence', _competence, 'automatic', true));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.student_current_month_invoice() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER student_automatic_invoice
AFTER INSERT OR UPDATE OF is_active ON public.students
FOR EACH ROW EXECUTE FUNCTION public.student_current_month_invoice();

CREATE EXTENSION IF NOT EXISTS pg_cron;
COMMENT ON FUNCTION public.generate_current_month_invoices() IS 'Trusted monthly scheduler only; creates current Sao Paulo month for active students, never updates existing invoices.';