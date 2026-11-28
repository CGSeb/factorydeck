CREATE TABLE "cli_connection" (
	"id" bigserial PRIMARY KEY,
	"account_id" bigint NOT NULL,
	"machine" text NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cli_connection_account_id_index" ON "cli_connection" ("account_id");--> statement-breakpoint
ALTER TABLE "cli_connection" ADD CONSTRAINT "cli_connection_account_id_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE;