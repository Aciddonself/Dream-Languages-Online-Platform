ALTER TABLE "users" ADD COLUMN "document_stamped_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "document_stamped_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "document_stamper_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "document_stamper_title" varchar(64);--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('student-photos', 'student-photos', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;