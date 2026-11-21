CREATE TABLE "source_file" (
	"path" text PRIMARY KEY,
	"size_bytes" bigint NOT NULL,
	"read_offset" bigint NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
