ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'admin' BEFORE 'head_academics';--> statement-breakpoint

CREATE OR REPLACE FUNCTION private.role_key() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.role::text FROM public.users u
  WHERE u.auth_id = (SELECT auth.uid()) AND u.deleted_at IS NULL
    AND u.status IN ('applicant', 'registered', 'active')
    AND (
      (u.role::text = 'super_admin' AND lower(u.email) = 'dreamlanguagesuganda@gmail.com')
      OR (u.role::text = 'admin' AND lower(u.email) = 'mabadilikojoseph300@gmail.com')
      OR u.role::text NOT IN ('super_admin', 'admin')
    )
    AND (u.role::text NOT IN ('super_admin', 'admin', 'finance', 'head_academics') OR (SELECT auth.jwt()) ->> 'aal' = 'aal2')
  LIMIT 1
$$;--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('users', 'audit_logs') LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format('CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING (private.has_role(''super_admin'', ''admin'')) WITH CHECK (private.has_role(''super_admin'', ''admin''))', t);
  END LOOP;
END $$;--> statement-breakpoint

DROP POLICY IF EXISTS admin_all ON public.users;--> statement-breakpoint
CREATE POLICY admin_select ON public.users FOR SELECT TO authenticated
  USING (private.has_role('super_admin', 'admin'));--> statement-breakpoint
CREATE POLICY admin_insert ON public.users FOR INSERT TO authenticated
  WITH CHECK (
    (private.has_role('super_admin') AND (role::text NOT IN ('super_admin', 'admin')
      OR (role::text = 'super_admin' AND lower(email) = 'dreamlanguagesuganda@gmail.com')
      OR (role::text = 'admin' AND lower(email) = 'mabadilikojoseph300@gmail.com')))
    OR (private.has_role('admin') AND role::text NOT IN ('super_admin', 'admin'))
  );--> statement-breakpoint
CREATE POLICY admin_update ON public.users FOR UPDATE TO authenticated
  USING (
    (private.has_role('super_admin') AND (role::text NOT IN ('super_admin', 'admin')
      OR (role::text = 'super_admin' AND lower(email) = 'dreamlanguagesuganda@gmail.com')
      OR (role::text = 'admin' AND lower(email) = 'mabadilikojoseph300@gmail.com')))
    OR (private.has_role('admin') AND role::text NOT IN ('super_admin', 'admin'))
  )
  WITH CHECK (
    (private.has_role('super_admin') AND (role::text NOT IN ('super_admin', 'admin')
      OR (role::text = 'super_admin' AND lower(email) = 'dreamlanguagesuganda@gmail.com')
      OR (role::text = 'admin' AND lower(email) = 'mabadilikojoseph300@gmail.com')))
    OR (private.has_role('admin') AND role::text NOT IN ('super_admin', 'admin'))
  );--> statement-breakpoint
CREATE POLICY admin_delete ON public.users FOR DELETE TO authenticated
  USING (
    private.has_role('super_admin')
    OR (private.has_role('admin') AND role::text NOT IN ('super_admin', 'admin'))
  );--> statement-breakpoint

DROP POLICY IF EXISTS admin_read ON public.audit_logs;--> statement-breakpoint
CREATE POLICY admin_read ON public.audit_logs FOR SELECT TO authenticated
  USING (private.has_role('super_admin', 'admin'));
