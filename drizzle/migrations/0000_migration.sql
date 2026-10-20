
-- ===== Tables =====
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  phone text CHECK (phone IS NULL OR phone ~ '^[0-9]{10,13}$'),
  instrument text CHECK (instrument IS NULL OR char_length(instrument) <= 60),
  monthly_amount_cents integer NOT NULL CHECK (monthly_amount_cents > 0 AND monthly_amount_cents <= 100000000),
  due_day smallint NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, teacher_id)
);
CREATE INDEX students_teacher_idx ON public.students(teacher_id);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  competence text NOT NULL CHECK (competence ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount_cents integer NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 100000000),
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id, competence),
  UNIQUE (id, teacher_id),
  FOREIGN KEY (student_id, teacher_id) REFERENCES public.students(id, teacher_id) ON DELETE RESTRICT
);
CREATE INDEX invoices_teacher_comp_idx ON public.invoices(teacher_id, competence);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  paid_at date NOT NULL,
  method text NOT NULL CHECK (method IN ('pix','dinheiro','transferencia','outro')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  reversed_at timestamptz,
  reversal_reason text CHECK (reversal_reason IS NULL OR char_length(reversal_reason) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id, teacher_id) REFERENCES public.invoices(id, teacher_id) ON DELETE RESTRICT
);
CREATE INDEX payments_invoice_idx ON public.payments(invoice_id);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON public.audit_logs(teacher_id, entity, entity_id);

-- ===== Grants (writes to invoices/payments/audit only via functions) =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.students, public.invoices, public.payments, public.audit_logs TO service_role;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own students select" ON public.students FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "own students insert" ON public.students FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "own students update" ON public.students FOR UPDATE TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "own students delete" ON public.students FOR DELETE TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "own invoices select" ON public.invoices FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "own payments select" ON public.payments FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "own audit select" ON public.audit_logs FOR SELECT TO authenticated USING (teacher_id = auth.uid());

-- ===== Ownership / timestamps triggers =====
CREATE OR REPLACE FUNCTION public.students_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
    NEW.teacher_id := auth.uid();
    NEW.created_at := now();
  ELSE
    NEW.teacher_id := OLD.teacher_id;
    NEW.id := OLD.id;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER students_guard BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.students_guard();

CREATE OR REPLACE FUNCTION public.students_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(teacher_id, entity, entity_id, action, metadata)
  VALUES (NEW.teacher_id, 'student', NEW.id, lower(TG_OP),
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
      'old_amount_cents', OLD.monthly_amount_cents, 'new_amount_cents', NEW.monthly_amount_cents,
      'old_active', OLD.is_active, 'new_active', NEW.is_active) ELSE '{}'::jsonb END);
  RETURN NEW;
END $$;
CREATE TRIGGER students_audit AFTER INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.students_audit();

-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public.invoice_paid_cents(_invoice_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(SUM(amount_cents), 0)::integer FROM public.payments
  WHERE invoice_id = _invoice_id AND reversed_at IS NULL
$$;

-- ===== View with computed status =====
CREATE VIEW public.invoice_summaries WITH (security_invoker = true) AS
SELECT i.id, i.teacher_id, i.student_id, s.name AS student_name, s.phone AS student_phone,
  i.competence, i.amount_cents, i.due_date, i.created_at, i.updated_at,
  COALESCE(p.paid, 0)::integer AS paid_cents,
  (i.amount_cents - COALESCE(p.paid, 0))::integer AS balance_cents,
  CASE WHEN i.amount_cents - COALESCE(p.paid, 0) <= 0 THEN 'paga'
       WHEN COALESCE(p.paid, 0) > 0 THEN 'parcial'
       ELSE 'pendente' END AS payment_status,
  (i.amount_cents - COALESCE(p.paid, 0) > 0 AND i.due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS is_overdue
FROM public.invoices i
JOIN public.students s ON s.id = i.student_id AND s.teacher_id = i.teacher_id
LEFT JOIN (SELECT invoice_id, SUM(amount_cents) AS paid FROM public.payments WHERE reversed_at IS NULL GROUP BY invoice_id) p
  ON p.invoice_id = i.id;
GRANT SELECT ON public.invoice_summaries TO authenticated;

-- ===== Business functions =====
CREATE OR REPLACE FUNCTION public.generate_invoices(_competence text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _n integer; _y int; _m int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _competence IS NULL OR _competence !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'invalid_competence'; END IF;
  _y := split_part(_competence, '-', 1)::int; _m := split_part(_competence, '-', 2)::int;
  IF _y < 2000 OR _y > 2100 THEN RAISE EXCEPTION 'invalid_competence'; END IF;
  WITH ins AS (
    INSERT INTO public.invoices(teacher_id, student_id, competence, amount_cents, due_date)
    SELECT _uid, s.id, _competence, s.monthly_amount_cents, make_date(_y, _m, s.due_day)
    FROM public.students s WHERE s.teacher_id = _uid AND s.is_active
    ON CONFLICT (teacher_id, student_id, competence) DO NOTHING
    RETURNING id
  ), aud AS (
    INSERT INTO public.audit_logs(teacher_id, entity, entity_id, action, metadata)
    SELECT _uid, 'invoice', id, 'generate', jsonb_build_object('competence', _competence) FROM ins
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM aud;
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.register_payment(_invoice_id uuid, _amount_cents integer, _paid_at date, _method text, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _inv public.invoices; _paid int; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _paid_at IS NULL OR _paid_at > (now() AT TIME ZONE 'America/Sao_Paulo')::date + 1 OR _paid_at < date '2000-01-01' THEN RAISE EXCEPTION 'invalid_date'; END IF;
  IF _method NOT IN ('pix','dinheiro','transferencia','outro') THEN RAISE EXCEPTION 'invalid_method'; END IF;
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id AND teacher_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  _paid := public.invoice_paid_cents(_inv.id);
  IF _paid + _amount_cents > _inv.amount_cents THEN RAISE EXCEPTION 'exceeds_balance'; END IF;
  INSERT INTO public.payments(teacher_id, invoice_id, amount_cents, paid_at, method, note)
  VALUES (_uid, _inv.id, _amount_cents, _paid_at, _method, NULLIF(btrim(left(_note, 500)), ''))
  RETURNING id INTO _id;
  INSERT INTO public.audit_logs(teacher_id, entity, entity_id, action, metadata)
  VALUES (_uid, 'payment', _id, 'create', jsonb_build_object('invoice_id', _inv.id, 'amount_cents', _amount_cents));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_payment(_payment_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _p public.payments;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _p FROM public.payments WHERE id = _payment_id AND teacher_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM 1 FROM public.invoices WHERE id = _p.invoice_id AND teacher_id = _uid FOR UPDATE;
  SELECT * INTO _p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF _p.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'already_reversed'; END IF;
  UPDATE public.payments SET reversed_at = now(), reversal_reason = NULLIF(btrim(left(_reason, 300)), '') WHERE id = _p.id;
  INSERT INTO public.audit_logs(teacher_id, entity, entity_id, action, metadata)
  VALUES (_uid, 'payment', _p.id, 'reverse', jsonb_build_object('invoice_id', _p.invoice_id, 'amount_cents', _p.amount_cents));
END $$;

CREATE OR REPLACE FUNCTION public.update_invoice(_invoice_id uuid, _amount_cents integer, _due_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _inv public.invoices; _paid int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 OR _amount_cents > 100000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _due_date IS NULL OR _due_date < date '2000-01-01' OR _due_date > date '2100-12-31' THEN RAISE EXCEPTION 'invalid_date'; END IF;
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id AND teacher_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  _paid := public.invoice_paid_cents(_inv.id);
  IF _paid >= _inv.amount_cents THEN RAISE EXCEPTION 'already_paid'; END IF;
  IF _amount_cents < _paid THEN RAISE EXCEPTION 'below_paid'; END IF;
  UPDATE public.invoices SET amount_cents = _amount_cents, due_date = _due_date, updated_at = now() WHERE id = _inv.id;
  INSERT INTO public.audit_logs(teacher_id, entity, entity_id, action, metadata)
  VALUES (_uid, 'invoice', _inv.id, 'update', jsonb_build_object(
    'old_amount_cents', _inv.amount_cents, 'new_amount_cents', _amount_cents,
    'old_due_date', _inv.due_date, 'new_due_date', _due_date));
END $$;

REVOKE ALL ON FUNCTION public.generate_invoices(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_payment(uuid, integer, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reverse_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_invoice(uuid, integer, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.students_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoices(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_payment(uuid, integer, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice(uuid, integer, date) TO authenticated;
