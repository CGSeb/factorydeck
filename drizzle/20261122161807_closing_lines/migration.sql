CREATE TABLE "closing_line" (
	"id" bigserial PRIMARY KEY,
	"source_path" text NOT NULL,
	"record_uuid" text NOT NULL,
	"session_id" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"position" bigint NOT NULL,
	"line" text NOT NULL,
	CONSTRAINT "closing_line_source_path_record_uuid_unique" UNIQUE("source_path","record_uuid")
);
--> statement-breakpoint
CREATE INDEX "closing_line_session_id_index" ON "closing_line" ("session_id");--> statement-breakpoint
ALTER TABLE "closing_line" ADD CONSTRAINT "closing_line_session_id_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE;