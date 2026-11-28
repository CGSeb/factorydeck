CREATE TABLE "ingest_file" (
	"file_key" text PRIMARY KEY,
	"read_to" bigint NOT NULL,
	"parser_version" integer NOT NULL,
	"reader_state" jsonb,
	"session_id" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
DROP VIEW "project_session";--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "remote" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "sent_by_account_id" bigint;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "sent_by_machine" text;--> statement-breakpoint
CREATE INDEX "ingest_file_session_id_index" ON "ingest_file" ("session_id");--> statement-breakpoint
ALTER TABLE "ingest_file" ADD CONSTRAINT "ingest_file_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_sent_by_account_id_account_id_fkey" FOREIGN KEY ("sent_by_account_id") REFERENCES "account"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE VIEW "project_session" AS (select s.id, s.agent, p.slug as project, s.project as root, s.cwd, s.cwd_from_main, s.git_branch, s.git_branches, s.title, s.first_at, s.last_at, s.turn_ended from session s left join root_remote r on r.root = s.project join project p on p.remote = coalesce(r.remote, s.remote));