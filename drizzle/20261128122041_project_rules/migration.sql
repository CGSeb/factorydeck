CREATE TABLE "project_rule" (
	"id" bigserial PRIMARY KEY,
	"project_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"position" integer NOT NULL,
	"name" text,
	"description" text,
	"agent_type" text,
	"source" text,
	"pattern" text,
	CONSTRAINT "project_rule_project_id_kind_position_unique" UNIQUE("project_id","kind","position"),
	CONSTRAINT "project_rule_kind" CHECK ("kind" in ('role', 'work_item')),
	CONSTRAINT "project_rule_position" CHECK ("position" >= 0),
	CONSTRAINT "project_rule_role" CHECK ("kind" <> 'role' or "name" is not null),
	CONSTRAINT "project_rule_work_item" CHECK ("kind" <> 'work_item' or ("source" is not null and "pattern" is not null))
);
--> statement-breakpoint
ALTER TABLE "project_rule" ADD CONSTRAINT "project_rule_project_id_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;