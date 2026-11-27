CREATE TABLE "friction_report" (
	"id" bigserial PRIMARY KEY,
	"project" text NOT NULL,
	"reported_at" timestamp with time zone NOT NULL,
	"period" text NOT NULL,
	"filters" jsonb NOT NULL,
	"groups" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "friction_report_project_reported_at_index" ON "friction_report" ("project","reported_at");