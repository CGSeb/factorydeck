ALTER TABLE "session" ADD COLUMN "agent" text DEFAULT 'claude-code' NOT NULL;--> statement-breakpoint
ALTER TABLE "source_file" ADD COLUMN "reader_state" jsonb;