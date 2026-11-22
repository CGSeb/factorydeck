ALTER TABLE "git_host_issue" ADD COLUMN "reopened" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "git_host_project" ADD COLUMN "stage_labels" jsonb;--> statement-breakpoint
ALTER TABLE "git_host_project" ADD COLUMN "auto_merge" boolean;--> statement-breakpoint
ALTER TABLE "git_host_request" ADD COLUMN "report" jsonb;