CREATE TABLE "api_call" (
	"id" bigserial PRIMARY KEY,
	"source_path" text NOT NULL,
	"request_key" text NOT NULL,
	"session_id" text NOT NULL,
	"sub_agent_id" text,
	"at" timestamp with time zone NOT NULL,
	"model" text NOT NULL,
	"input_tokens" bigint NOT NULL,
	"cache_write_tokens" bigint NOT NULL,
	"cache_read_tokens" bigint NOT NULL,
	"output_tokens" bigint NOT NULL,
	CONSTRAINT "api_call_source_path_request_key_unique" UNIQUE("source_path","request_key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY,
	"project" text DEFAULT 'unassigned' NOT NULL,
	"cwd" text,
	"git_branch" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"first_at" timestamp with time zone,
	"last_at" timestamp with time zone,
	"turn_ended" boolean DEFAULT false NOT NULL,
	"last_stop_reason" text,
	"user_after_last_assistant" boolean DEFAULT false NOT NULL,
	"last_user_interrupted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_launch" (
	"id" bigserial PRIMARY KEY,
	"source_path" text NOT NULL,
	"record_uuid" text NOT NULL,
	"session_id" text NOT NULL,
	"sub_agent_id" text,
	"at" timestamp with time zone NOT NULL,
	"skill" text NOT NULL,
	CONSTRAINT "skill_launch_source_path_record_uuid_skill_unique" UNIQUE("source_path","record_uuid","skill")
);
--> statement-breakpoint
CREATE TABLE "sub_agent" (
	"session_id" text,
	"id" text,
	"tool_use_id" text DEFAULT '' NOT NULL,
	"agent_type" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"first_at" timestamp with time zone,
	"last_at" timestamp with time zone,
	CONSTRAINT "sub_agent_pkey" PRIMARY KEY("session_id","id")
);
--> statement-breakpoint
CREATE TABLE "user_prompt" (
	"id" bigserial PRIMARY KEY,
	"source_path" text NOT NULL,
	"record_uuid" text NOT NULL,
	"session_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"prompt_id" text,
	"command" text,
	CONSTRAINT "user_prompt_source_path_record_uuid_unique" UNIQUE("source_path","record_uuid")
);
--> statement-breakpoint
CREATE INDEX "api_call_session_id_index" ON "api_call" ("session_id");--> statement-breakpoint
CREATE INDEX "api_call_at_index" ON "api_call" ("at");--> statement-breakpoint
CREATE INDEX "skill_launch_session_id_index" ON "skill_launch" ("session_id");--> statement-breakpoint
CREATE INDEX "user_prompt_session_id_prompt_id_index" ON "user_prompt" ("session_id","prompt_id");--> statement-breakpoint
ALTER TABLE "api_call" ADD CONSTRAINT "api_call_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_call" ADD CONSTRAINT "api_call_session_id_sub_agent_id_sub_agent_session_id_id_fkey" FOREIGN KEY ("session_id","sub_agent_id") REFERENCES "sub_agent"("session_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "skill_launch" ADD CONSTRAINT "skill_launch_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "skill_launch" ADD CONSTRAINT "skill_launch_E07h168TB1pR_fkey" FOREIGN KEY ("session_id","sub_agent_id") REFERENCES "sub_agent"("session_id","id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sub_agent" ADD CONSTRAINT "sub_agent_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_prompt" ADD CONSTRAINT "user_prompt_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;