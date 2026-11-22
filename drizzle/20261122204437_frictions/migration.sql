CREATE TABLE "friction" (
	"id" bigserial PRIMARY KEY,
	"source_path" text NOT NULL,
	"record_uuid" text NOT NULL,
	"position" integer NOT NULL,
	"session_id" text NOT NULL,
	"sub_agent_id" text,
	"at" timestamp with time zone NOT NULL,
	"agent" text NOT NULL,
	"kind" text NOT NULL,
	"tool" text,
	"category" text,
	"program" text,
	"exit_code" integer,
	"command_hash" text,
	"hook_command" text,
	"trigger" text,
	"pre_tokens" bigint,
	"post_tokens" bigint,
	CONSTRAINT "friction_source_path_record_uuid_kind_position_unique" UNIQUE("source_path","record_uuid","kind","position")
);
--> statement-breakpoint
ALTER TABLE "ingest_state" ADD COLUMN "frictions_read_done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "friction_session_id_index" ON "friction" ("session_id");--> statement-breakpoint
CREATE INDEX "friction_at_index" ON "friction" ("at");--> statement-breakpoint
ALTER TABLE "friction" ADD CONSTRAINT "friction_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "friction" ADD CONSTRAINT "friction_session_id_sub_agent_id_sub_agent_session_id_id_fkey" FOREIGN KEY ("session_id","sub_agent_id") REFERENCES "sub_agent"("session_id","id") ON DELETE CASCADE;