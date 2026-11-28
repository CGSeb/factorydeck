CREATE TABLE "project" (
	"id" bigserial PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"remote" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" bigint
);
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_account_id_fkey" FOREIGN KEY ("created_by") REFERENCES "account"("id") ON DELETE SET NULL;