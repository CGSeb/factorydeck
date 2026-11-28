DROP VIEW "project_git_host";--> statement-breakpoint
DROP VIEW "project_issue";--> statement-breakpoint
DROP VIEW "project_request";--> statement-breakpoint
ALTER TABLE "git_host_issue" RENAME COLUMN "project" TO "remote";--> statement-breakpoint
ALTER TABLE "git_host_project" RENAME COLUMN "project" TO "remote";--> statement-breakpoint
ALTER TABLE "git_host_request" RENAME COLUMN "project" TO "remote";--> statement-breakpoint
CREATE VIEW "project_git_host" AS (select p.slug as project, g.remote, g.git_host, g.repository, g.synced_from, g.error, g.error_git_host, g.stage_labels, g.auto_merge, g.bug_label, g.history_read, g.fix_read, g.state_events_read, g.body_closes_read from git_host_project g join project p on p.remote = g.remote);--> statement-breakpoint
CREATE VIEW "project_issue" AS (select p.slug as project, i.number, i.title, i.state, i.labels, i.url, i.created_at, i.closed_at, i.updated_at, i.reopened, i.state_events, i.needs_spec from git_host_issue i join project p on p.remote = i.remote);--> statement-breakpoint
CREATE VIEW "project_request" AS (select p.slug as project, q.number, q.title, q.state, q.draft, q.head_branch, q.url, q.created_at, q.merged_at, q.closed_at, q.updated_at, q.closes, q.checks, q.report, q.reports from git_host_request q join project p on p.remote = q.remote);