-- Allow authenticated users to INSERT alerts (for AI threat detection)
-- Admins/RH/Managers can still see all alerts via SELECT
DROP POLICY IF EXISTS "alerts access" ON public.alerts;

-- SELECT: Admins/RH/Managers see all; others see only their own
-- INSERT: Any authenticated user can insert
-- UPDATE/DELETE: Only admins/RH/Managers
CREATE POLICY "alerts select" ON public.alerts FOR SELECT TO authenticated
  USING (target_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'rh') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "alerts insert" ON public.alerts FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "alerts update" ON public.alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'rh') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'rh') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "alerts delete" ON public.alerts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'rh') OR public.has_role(auth.uid(), 'manager'));
