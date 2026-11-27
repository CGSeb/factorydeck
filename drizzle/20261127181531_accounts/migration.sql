CREATE TABLE "account" (
	"id" bigserial PRIMARY KEY,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	CONSTRAINT "account_role_check" CHECK ("role" in ('manager', 'dev'))
);
--> statement-breakpoint
CREATE TABLE "account_token" (
	"id" bigserial PRIMARY KEY,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"email" text,
	"role" text,
	"account_id" bigint,
	"created_by" bigint,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "account_token_kind_check" CHECK ("kind" in ('invitation', 'reset')),
	CONSTRAINT "account_token_role_check" CHECK ("role" is null or "role" in ('manager', 'dev'))
);
--> statement-breakpoint
CREATE TABLE "sign_in_session" (
	"id" bigserial PRIMARY KEY,
	"account_id" bigint NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_email_unique" ON "account" (lower("email"));--> statement-breakpoint
CREATE INDEX "sign_in_session_account_id_index" ON "sign_in_session" ("account_id");--> statement-breakpoint
ALTER TABLE "account_token" ADD CONSTRAINT "account_token_account_id_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "account_token" ADD CONSTRAINT "account_token_created_by_account_id_fkey" FOREIGN KEY ("created_by") REFERENCES "account"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sign_in_session" ADD CONSTRAINT "sign_in_session_account_id_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE;