-- Row Level Security for every table in the public schema.
-- Application servers connect as the table owner (Drizzle) and are trusted; these policies protect every
-- path that reaches the database through Supabase's API roles (anon / authenticated): PostgREST, Realtime, Storage.
-- Privileged roles (super_admin, head_academics, finance) only receive powers on an MFA (aal2) session.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.uid() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.id FROM public.users u
  WHERE u.auth_id = (SELECT auth.uid()) AND u.deleted_at IS NULL
    AND u.status IN ('applicant', 'registered', 'active')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.role_key() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.role::text FROM public.users u
  WHERE u.auth_id = (SELECT auth.uid()) AND u.deleted_at IS NULL
    AND u.status IN ('applicant', 'registered', 'active')
    AND (u.role::text NOT IN ('super_admin', 'finance', 'head_academics') OR (SELECT auth.jwt()) ->> 'aal' = 'aal2')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.has_role(VARIADIC roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE(private.role_key() = ANY (roles), false) $$;

CREATE OR REPLACE FUNCTION private.is_enrolled(p_class uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.enrolments e WHERE e.class_id = p_class AND e.student_id = private.uid()) $$;

CREATE OR REPLACE FUNCTION private.teaches(p_class uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = p_class AND c.teacher_id = private.uid()) $$;

CREATE OR REPLACE FUNCTION private.teaches_session(p_session uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.timetable_sessions s LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = p_session AND (s.teacher_id = private.uid() OR c.teacher_id = private.uid())
  )
$$;

CREATE OR REPLACE FUNCTION private.teaches_student(p_student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrolments e JOIN public.classes c ON c.id = e.class_id
    WHERE e.student_id = p_student AND c.teacher_id = private.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.in_group(p_group uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = p_group AND m.user_id = private.uid()) $$;

CREATE OR REPLACE FUNCTION private.in_room(p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.room_members m WHERE m.room_id = p_room AND m.user_id = private.uid()) $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- Default deny: enable RLS on every table, remove broad default grants, add the admin policy per table.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    IF t <> 'audit_logs' THEN
      EXECUTE format('CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING (private.has_role(''super_admin'')) WITH CHECK (private.has_role(''super_admin''))', t);
    END IF;
  END LOOP;
END $$;

-- Public website content (readable without signing in).
GRANT SELECT ON public.departments, public.programmes, public.levels, public.terms, public.faqs,
  public.partners, public.testimonials, public.news_posts, public.cms_pages TO anon;

CREATE POLICY public_read ON public.departments FOR SELECT TO anon, authenticated USING (deleted_at IS NULL);
CREATE POLICY public_read ON public.programmes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read ON public.levels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read ON public.terms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY public_read ON public.faqs FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY public_read ON public.partners FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY public_read ON public.testimonials FOR SELECT TO anon, authenticated USING (published);
CREATE POLICY public_read ON public.news_posts FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY public_read ON public.cms_pages FOR SELECT TO anon, authenticated USING (status = 'published');

-- Head of Academics: read and update, never delete (no DELETE policy exists for this role).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['departments','programmes','levels','terms','classes','timetable_sessions','grade_scales','exams','results',
    'resit_requests','cms_pages','news_posts','testimonials','faqs','partners','announcements','community_groups','support_tickets',
    'documents','teacher_applications','attendance','materials','assignments','submissions','exam_attempts','exam_questions','enrolments'] LOOP
    EXECUTE format('CREATE POLICY hoc_read ON public.%I FOR SELECT TO authenticated USING (private.has_role(''head_academics''))', t);
    EXECUTE format('CREATE POLICY hoc_update ON public.%I FOR UPDATE TO authenticated USING (private.has_role(''head_academics'')) WITH CHECK (private.has_role(''head_academics''))', t);
  END LOOP;
END $$;

-- Reference data readable by any signed-in user.
CREATE POLICY signed_in_read ON public.grade_scales FOR SELECT TO authenticated USING (true);
CREATE POLICY signed_in_read ON public.fee_structures FOR SELECT TO authenticated USING (true);
CREATE POLICY signed_in_read ON public.document_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY signed_in_read ON public.community_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY signed_in_read ON public.discussion_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY signed_in_read ON public.announcements FOR SELECT TO authenticated USING (published_at IS NOT NULL);
CREATE POLICY signed_in_read ON public.settings FOR SELECT TO authenticated USING (key LIKE 'public.%');

-- users: only non-sensitive columns are reachable through API roles. Phone, address, date of birth and next-of-kin data
-- are read by the trusted server only, so teachers and students never see each other's numbers.
REVOKE ALL ON public.users FROM authenticated;
GRANT SELECT (id, email, role, status, display_name, first_name, last_name, avatar_url, registration_number, department_id,
  study_format, study_mode, is_international, created_at, updated_at) ON public.users TO authenticated;
GRANT UPDATE (display_name, first_name, last_name, avatar_url) ON public.users TO authenticated;

CREATE POLICY self_read ON public.users FOR SELECT TO authenticated USING (id = (SELECT private.uid()));
CREATE POLICY self_update ON public.users FOR UPDATE TO authenticated USING (id = (SELECT private.uid())) WITH CHECK (id = (SELECT private.uid()));
CREATE POLICY hoc_read ON public.users FOR SELECT TO authenticated USING (private.has_role('head_academics'));
CREATE POLICY hoc_update ON public.users FOR UPDATE TO authenticated USING (private.has_role('head_academics')) WITH CHECK (private.has_role('head_academics'));
CREATE POLICY teacher_read_students ON public.users FOR SELECT TO authenticated USING (private.has_role('teacher') AND private.teaches_student(id));
CREATE POLICY finance_read_students ON public.users FOR SELECT TO authenticated USING (private.has_role('finance') AND role IN ('student', 'applicant'));

-- Defence in depth: API roles can never change identity or privilege fields, even if grants are widened later.
CREATE OR REPLACE FUNCTION private.guard_user_privileges() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
       NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status OR NEW.auth_id IS DISTINCT FROM OLD.auth_id
    OR NEW.email IS DISTINCT FROM OLD.email OR NEW.registration_number IS DISTINCT FROM OLD.registration_number
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
    RAISE EXCEPTION 'Identity and privilege fields cannot be changed through the API' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_guard_privileges BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION private.guard_user_privileges();

-- Academic structure.
CREATE POLICY teacher_read ON public.classes FOR SELECT TO authenticated USING (teacher_id = (SELECT private.uid()));
CREATE POLICY teacher_update ON public.classes FOR UPDATE TO authenticated USING (teacher_id = (SELECT private.uid())) WITH CHECK (teacher_id = (SELECT private.uid()));
CREATE POLICY student_read ON public.classes FOR SELECT TO authenticated USING (private.is_enrolled(id));

CREATE POLICY own_read ON public.enrolments FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY teacher_read ON public.enrolments FOR SELECT TO authenticated USING (private.teaches(class_id));
CREATE POLICY finance_read ON public.enrolments FOR SELECT TO authenticated USING (private.has_role('finance'));

-- timetable_sessions: the live-class link (meet_url) is never exposed through API roles.
CREATE POLICY student_read ON public.timetable_sessions FOR SELECT TO authenticated USING (private.is_enrolled(class_id));
CREATE POLICY teacher_read ON public.timetable_sessions FOR SELECT TO authenticated USING (private.teaches_session(id));
CREATE POLICY teacher_insert ON public.timetable_sessions FOR INSERT TO authenticated
  WITH CHECK (private.has_role('teacher') AND private.teaches(class_id));
CREATE POLICY teacher_update ON public.timetable_sessions FOR UPDATE TO authenticated
  USING (private.teaches_session(id)) WITH CHECK (private.teaches(class_id));
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'timetable_sessions' AND column_name <> 'meet_url';
  EXECUTE 'REVOKE ALL ON public.timetable_sessions FROM authenticated';
  EXECUTE format('GRANT SELECT (%1$s), INSERT (%1$s), UPDATE (%1$s) ON public.timetable_sessions TO authenticated', cols);
  EXECUTE 'GRANT DELETE ON public.timetable_sessions TO authenticated';
END $$;

-- Attendance.
CREATE POLICY own_read ON public.attendance FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY teacher_read ON public.attendance FOR SELECT TO authenticated USING (private.teaches_session(session_id));
CREATE POLICY teacher_insert ON public.attendance FOR INSERT TO authenticated WITH CHECK (private.teaches_session(session_id));
CREATE POLICY teacher_update ON public.attendance FOR UPDATE TO authenticated USING (private.teaches_session(session_id)) WITH CHECK (private.teaches_session(session_id));

-- Teaching content.
CREATE POLICY student_read ON public.materials FOR SELECT TO authenticated USING (private.is_enrolled(class_id));
CREATE POLICY teacher_read ON public.materials FOR SELECT TO authenticated USING (private.teaches(class_id));
CREATE POLICY teacher_insert ON public.materials FOR INSERT TO authenticated WITH CHECK (private.teaches(class_id));
CREATE POLICY teacher_update ON public.materials FOR UPDATE TO authenticated USING (private.teaches(class_id)) WITH CHECK (private.teaches(class_id));

CREATE POLICY student_read ON public.assignments FOR SELECT TO authenticated USING (private.is_enrolled(class_id));
CREATE POLICY teacher_read ON public.assignments FOR SELECT TO authenticated USING (private.teaches(class_id));
CREATE POLICY teacher_insert ON public.assignments FOR INSERT TO authenticated WITH CHECK (private.teaches(class_id));
CREATE POLICY teacher_update ON public.assignments FOR UPDATE TO authenticated USING (private.teaches(class_id)) WITH CHECK (private.teaches(class_id));

CREATE POLICY own_read ON public.submissions FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_insert ON public.submissions FOR INSERT TO authenticated WITH CHECK (student_id = (SELECT private.uid()) AND score IS NULL AND graded_at IS NULL);
CREATE POLICY teacher_read ON public.submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND private.teaches(a.class_id)));
CREATE POLICY teacher_update ON public.submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND private.teaches(a.class_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND private.teaches(a.class_id)));

-- Exams: students never read questions/answers directly (the server delivers them), only published exam headers.
CREATE POLICY student_read ON public.exams FOR SELECT TO authenticated USING (published AND private.is_enrolled(class_id));
CREATE POLICY teacher_read ON public.exams FOR SELECT TO authenticated USING (teacher_id = (SELECT private.uid()));
CREATE POLICY teacher_insert ON public.exams FOR INSERT TO authenticated WITH CHECK (teacher_id = (SELECT private.uid()) AND private.has_role('teacher'));
CREATE POLICY teacher_update ON public.exams FOR UPDATE TO authenticated USING (teacher_id = (SELECT private.uid())) WITH CHECK (teacher_id = (SELECT private.uid()));
CREATE POLICY teacher_read ON public.exam_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = (SELECT private.uid())));
CREATE POLICY teacher_write ON public.exam_questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = (SELECT private.uid())));
CREATE POLICY teacher_update ON public.exam_questions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = (SELECT private.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = (SELECT private.uid())));
CREATE POLICY own_read ON public.exam_attempts FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY teacher_read ON public.exam_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = (SELECT private.uid())));
CREATE POLICY teacher_update ON public.exam_attempts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = (SELECT private.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = (SELECT private.uid())));

-- Results: students only see published results.
CREATE POLICY own_read ON public.results FOR SELECT TO authenticated USING (published AND student_id = (SELECT private.uid()));
CREATE POLICY teacher_read ON public.results FOR SELECT TO authenticated USING (private.teaches(class_id));
CREATE POLICY teacher_insert ON public.results FOR INSERT TO authenticated WITH CHECK (private.teaches(class_id));
CREATE POLICY teacher_update ON public.results FOR UPDATE TO authenticated USING (private.teaches(class_id)) WITH CHECK (private.teaches(class_id));

CREATE POLICY own_read ON public.resit_requests FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_insert ON public.resit_requests FOR INSERT TO authenticated WITH CHECK (student_id = (SELECT private.uid()) AND status = 'pending');
CREATE POLICY teacher_read ON public.resit_requests FOR SELECT TO authenticated
  USING (private.has_role('teacher') AND private.teaches_student(student_id));

-- Finance: read/insert/update, never delete (no DELETE policy exists for this role).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fee_structures','fee_schedules','invoices','payments','receipts','holds','discounts','ledger_entries','pause_requests','status_history'] LOOP
    EXECUTE format('CREATE POLICY finance_read ON public.%I FOR SELECT TO authenticated USING (private.has_role(''finance''))', t);
    EXECUTE format('CREATE POLICY finance_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (private.has_role(''finance''))', t);
    EXECUTE format('CREATE POLICY finance_update ON public.%I FOR UPDATE TO authenticated USING (private.has_role(''finance'')) WITH CHECK (private.has_role(''finance''))', t);
  END LOOP;
END $$;

-- Students: own financial rows only.
CREATE POLICY own_read ON public.fee_schedules FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_read ON public.invoices FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_read ON public.payments FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_insert ON public.payments FOR INSERT TO authenticated WITH CHECK (student_id = (SELECT private.uid()) AND status = 'pending');
CREATE POLICY own_read ON public.receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id AND p.student_id = (SELECT private.uid())));
CREATE POLICY own_read ON public.holds FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_read ON public.discounts FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_read ON public.ledger_entries FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_read ON public.pause_requests FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_insert ON public.pause_requests FOR INSERT TO authenticated WITH CHECK (student_id = (SELECT private.uid()) AND status = 'pending');
CREATE POLICY own_read ON public.status_history FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));

-- Documents, certificates, notifications, support.
CREATE POLICY own_read ON public.documents FOR SELECT TO authenticated USING (owner_id = (SELECT private.uid()));
CREATE POLICY own_read ON public.certificates FOR SELECT TO authenticated USING (student_id = (SELECT private.uid()));
CREATE POLICY own_read ON public.notifications FOR SELECT TO authenticated USING (user_id = (SELECT private.uid()));
CREATE POLICY own_update ON public.notifications FOR UPDATE TO authenticated USING (user_id = (SELECT private.uid())) WITH CHECK (user_id = (SELECT private.uid()));
CREATE POLICY own_read ON public.support_tickets FOR SELECT TO authenticated USING (user_id = (SELECT private.uid()));
CREATE POLICY own_insert ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT private.uid()));

-- Community: membership-scoped reads. No INSERT policies on posts/comments/messages, so every write goes through the
-- server, where the phone-number filter runs before anything is stored.
CREATE POLICY member_read ON public.group_members FOR SELECT TO authenticated USING (user_id = (SELECT private.uid()));
CREATE POLICY member_read ON public.room_members FOR SELECT TO authenticated USING (user_id = (SELECT private.uid()));
CREATE POLICY member_read ON public.posts FOR SELECT TO authenticated USING (private.in_group(group_id));
CREATE POLICY member_read ON public.comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND private.in_group(p.group_id)));
CREATE POLICY party_read ON public.messages FOR SELECT TO authenticated
  USING (sender_id = (SELECT private.uid()) OR recipient_id = (SELECT private.uid()) OR (room_id IS NOT NULL AND private.in_room(room_id)));

-- Immutable audit log: admin may read; nobody can update, delete or truncate.
CREATE POLICY admin_read ON public.audit_logs FOR SELECT TO authenticated USING (private.has_role('super_admin'));
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;
CREATE OR REPLACE FUNCTION private.audit_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = '42501'; END $$;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION private.audit_immutable();
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON public.audit_logs FOR EACH STATEMENT EXECUTE FUNCTION private.audit_immutable();
