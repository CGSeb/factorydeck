CREATE TABLE "ingest_state" (
	"id" text PRIMARY KEY,
	"factory_cleanup_done" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skipped_file" (
	"path" text PRIMARY KEY,
	"session_id" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"project" text
);
--> statement-breakpoint
CREATE INDEX "skipped_file_session_id_index" ON "skipped_file" ("session_id");