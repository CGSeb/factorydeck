CREATE TABLE "git_host_issue" (
	"project" text,
	"number" integer,
	"title" text NOT NULL,
	"state" text NOT NULL,
	"labels" jsonb NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "git_host_issue_pkey" PRIMARY KEY("project","number")
);
--> statement-breakpoint
CREATE TABLE "git_host_project" (
	"project" text PRIMARY KEY,
	"git_host" text,
	"repository" text,
	"synced_from" timestamp with time zone,
	"error" text,
	"error_git_host" text
);
--> statement-breakpoint
CREATE TABLE "git_host_request" (
	"project" text,
	"number" integer,
	"title" text NOT NULL,
	"state" text NOT NULL,
	"draft" boolean NOT NULL,
	"head_branch" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"merged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	"closes" jsonb NOT NULL,
	"checks" text NOT NULL,
	CONSTRAINT "git_host_request_pkey" PRIMARY KEY("project","number")
);
--> statement-breakpoint
CREATE TABLE "git_host_run" (
	"id" text PRIMARY KEY,
	"finished_at" timestamp with time zone NOT NULL
);
