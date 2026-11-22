ALTER TABLE "git_host_issue" ADD COLUMN "needs_spec" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "git_host_project" ADD COLUMN "history_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "git_host_request" ADD COLUMN "reports" jsonb DEFAULT '[]' NOT NULL;