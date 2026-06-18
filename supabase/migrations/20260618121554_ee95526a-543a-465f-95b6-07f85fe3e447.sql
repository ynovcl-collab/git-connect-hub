CREATE TABLE public.medical_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  description TEXT,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low','normal','high')),
  preferred_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scheduled','done','cancelled')),
  doctor_notes TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_requests TO authenticated;
GRANT ALL ON public.medical_requests TO service_role;

ALTER TABLE public.medical_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee can read own medical requests" ON public.medical_requests
  FOR SELECT TO authenticated USING (employee_id = auth.uid());
CREATE POLICY "employee can insert own medical requests" ON public.medical_requests
  FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "employee can update own pending requests" ON public.medical_requests
  FOR UPDATE TO authenticated USING (employee_id = auth.uid() AND status = 'pending');
CREATE POLICY "doctor can read all medical requests" ON public.medical_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'medecin'));
CREATE POLICY "doctor can update medical requests" ON public.medical_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'medecin'));

CREATE OR REPLACE FUNCTION public.touch_medical_requests() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_medical_requests_updated
BEFORE UPDATE ON public.medical_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_medical_requests();

ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_requests;