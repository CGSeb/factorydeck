ALTER TABLE "project" ADD COLUMN "git_host" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "token_ciphertext" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "token_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "token_set_by" bigint;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_token_set_by_account_id_fkey" FOREIGN KEY ("token_set_by") REFERENCES "account"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_git_host" CHECK ("git_host" is null or "git_host" in ('github', 'gitlab'));