CREATE TABLE "finance_cash_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" varchar(12) NOT NULL,
	"entry_date" date NOT NULL,
	"week_start" date NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'UGX' NOT NULL,
	"category" varchar(64) NOT NULL,
	"purpose" text NOT NULL,
	"reference" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reversed_at" timestamp,
	"reversed_by" uuid,
	"reversal_reason" text
);
--> statement-breakpoint
CREATE TABLE "student_access_overrides" (
	"student_id" uuid PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"granted_by" uuid NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_cash_entries" ADD CONSTRAINT "finance_cash_entries_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_cash_entries" ADD CONSTRAINT "finance_cash_entries_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_access_overrides" ADD CONSTRAINT "student_access_overrides_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_access_overrides" ADD CONSTRAINT "student_access_overrides_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_cash_entries_week_currency_idx" ON "finance_cash_entries" USING btree ("week_start","currency");--> statement-breakpoint
CREATE INDEX "finance_cash_entries_created_idx" ON "finance_cash_entries" USING btree ("created_at");
--> statement-breakpoint
ALTER TABLE public.finance_cash_entries
  ADD CONSTRAINT finance_cash_entries_direction_check CHECK (direction IN ('income', 'expense')),
  ADD CONSTRAINT finance_cash_entries_positive_amount_check CHECK (amount > 0),
  ADD CONSTRAINT finance_cash_entries_week_start_check CHECK (week_start = date_trunc('week', entry_date::timestamp)::date);
--> statement-breakpoint
ALTER TABLE public.finance_cash_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY finance_cash_entries_finance_all ON public.finance_cash_entries
  FOR ALL TO authenticated
  USING (private.has_role('super_admin', 'admin', 'finance'))
  WITH CHECK (private.has_role('super_admin', 'admin', 'finance'));
--> statement-breakpoint
ALTER TABLE public.student_access_overrides ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY student_access_overrides_admin_all ON public.student_access_overrides
  FOR ALL TO authenticated
  USING (private.has_role('super_admin', 'admin'))
  WITH CHECK (private.has_role('super_admin', 'admin'));
--> statement-breakpoint
CREATE POLICY student_access_overrides_student_read ON public.student_access_overrides
  FOR SELECT TO authenticated
  USING (student_id = private.uid());
