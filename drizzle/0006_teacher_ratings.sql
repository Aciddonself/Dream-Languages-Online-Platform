CREATE TABLE "teacher_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_rating_unique" ON "teacher_ratings" USING btree ("teacher_id","student_id");--> statement-breakpoint
ALTER TABLE "teacher_ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "teacher_ratings_public_read" ON "teacher_ratings" FOR SELECT TO anon, authenticated USING (published);--> statement-breakpoint
CREATE POLICY "teacher_ratings_own" ON "teacher_ratings" FOR SELECT TO authenticated USING (student_id = private.uid() OR private.has_role('super_admin'));