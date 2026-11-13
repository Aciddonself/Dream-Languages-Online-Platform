ALTER TABLE "class_recordings" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "class_recordings" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "class_recordings" ADD COLUMN "external" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "class_recordings" ADD COLUMN "upload_complete" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "storage_path" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "file_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "upload_complete" boolean DEFAULT true NOT NULL;--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('class-materials', 'class-materials', false, 262144000, ARRAY[
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/aac',
  'video/mp4', 'video/webm', 'video/quicktime'
]) ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
