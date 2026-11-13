CREATE TABLE "class_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"session_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"recording_url" text NOT NULL,
	"storage_path" text,
	"file_name" text,
	"external" boolean DEFAULT false NOT NULL,
	"upload_complete" boolean DEFAULT true NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "file_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "upload_complete" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "class_recordings" ADD CONSTRAINT "class_recordings_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_recordings" ADD CONSTRAINT "class_recordings_session_id_timetable_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."timetable_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_recordings" ADD CONSTRAINT "class_recordings_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_recordings_class_created_idx" ON "class_recordings" USING btree ("class_id","created_at");
--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('class-materials', 'class-materials', false, 262144000, ARRAY[
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/aac',
  'video/mp4', 'video/webm', 'video/quicktime'
]) ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
--> statement-breakpoint
ALTER TABLE "class_recordings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "school_holidays" ENABLE ROW LEVEL SECURITY;

