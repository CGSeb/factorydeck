ALTER TABLE "session" ADD COLUMN "cwd_from_main" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sub_agent" ADD COLUMN "cwd" text;