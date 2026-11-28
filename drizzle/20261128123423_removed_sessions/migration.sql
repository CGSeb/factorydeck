CREATE TABLE "removed_session" (
	"session_id" text PRIMARY KEY,
	"project_name" text NOT NULL,
	"removed_at" timestamp with time zone NOT NULL
);
