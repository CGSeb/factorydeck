ALTER TABLE "ingest_state" ADD COLUMN "branches_read_done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "git_branches" text[] DEFAULT '{}'::text[] NOT NULL;