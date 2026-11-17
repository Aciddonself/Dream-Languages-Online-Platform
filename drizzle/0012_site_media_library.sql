CREATE TABLE "site_images" (
	"slot" varchar(64) PRIMARY KEY NOT NULL,
	"storage_path" text NOT NULL,
	"alt_text" text NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_images" ADD CONSTRAINT "site_images_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "site_images" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "site_images_public_read" ON "site_images" FOR SELECT USING (true);
--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 12582912, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
