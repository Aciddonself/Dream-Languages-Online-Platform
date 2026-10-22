DROP TABLE "sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "two_factor_secret";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "two_factor_enabled";