CREATE TABLE "teacher_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"language_taught" text NOT NULL,
	"is_volunteer" boolean NOT NULL,
	"pay_per_session" integer,
	"availability" varchar(16),
	"next_of_kin_name" text NOT NULL,
	"next_of_kin_relationship" text NOT NULL,
	"next_of_kin_phone" text NOT NULL,
	"next_of_kin_address" text NOT NULL,
	"reference_name" text,
	"reference_phone" text,
	"cv_path" text NOT NULL,
	"cover_letter_path" text NOT NULL,
	"recommendation_path" text,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_logs" ADD COLUMN "dedupe_key" varchar(255);--> statement-breakpoint
ALTER TABLE "fee_schedules" ADD COLUMN "currency" varchar(8) DEFAULT 'UGX' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "currency" varchar(8) DEFAULT 'UGX' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_storage_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "next_of_kin_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "next_of_kin_relationship" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "next_of_kin_phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "next_of_kin_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "study_format" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "study_duration_months" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "study_mode" varchar(16);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_international" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_applications" ADD CONSTRAINT "teacher_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_dedupe_key_unique" UNIQUE("dedupe_key");