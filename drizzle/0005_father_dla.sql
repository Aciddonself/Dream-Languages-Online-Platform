CREATE TABLE "father_dla_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"report" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "father_dla_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(12) NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb,
	"model" varchar(64),
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "father_dla_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"cefr_level" varchar(2) DEFAULT 'A1' NOT NULL,
	"target_language" varchar(40),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "father_dla_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"role" varchar(24),
	"model" varchar(64) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL,
	"cost_micro_usd" integer DEFAULT 0 NOT NULL,
	"question" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "father_dla_feedback" ADD CONSTRAINT "father_dla_feedback_message_id_father_dla_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."father_dla_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "father_dla_feedback" ADD CONSTRAINT "father_dla_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "father_dla_messages" ADD CONSTRAINT "father_dla_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "father_dla_profiles" ADD CONSTRAINT "father_dla_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "father_dla_usage" ADD CONSTRAINT "father_dla_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "father_dla_feedback_unique" ON "father_dla_feedback" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "father_dla_messages_user_idx" ON "father_dla_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "father_dla_usage_created_idx" ON "father_dla_usage" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "father_dla_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "father_dla_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "father_dla_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "father_dla_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- A student sees and manages only their own Father-DLA data; nobody else (not even staff) can read chats.
CREATE POLICY "father_dla_profiles_own" ON "father_dla_profiles" FOR ALL TO authenticated USING (user_id = private.uid()) WITH CHECK (user_id = private.uid());--> statement-breakpoint
CREATE POLICY "father_dla_messages_own" ON "father_dla_messages" FOR ALL TO authenticated USING (user_id = private.uid()) WITH CHECK (user_id = private.uid());--> statement-breakpoint
CREATE POLICY "father_dla_feedback_own" ON "father_dla_feedback" FOR ALL TO authenticated USING (user_id = private.uid()) WITH CHECK (user_id = private.uid());--> statement-breakpoint
-- Usage/cost rows are readable by the super admin only; writes happen server-side.
CREATE POLICY "father_dla_usage_admin_read" ON "father_dla_usage" FOR SELECT TO authenticated USING (private.has_role('super_admin'));
