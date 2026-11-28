-- Custom SQL migration file, put your code below! --
CREATE TEMPORARY TABLE "git_host_kept_root" AS
SELECT DISTINCT ON (r."remote") r."root", r."remote"
FROM (
  SELECT "remote" AS "root" FROM "git_host_project"
  UNION SELECT "remote" FROM "git_host_issue"
  UNION SELECT "remote" FROM "git_host_request"
) c
JOIN "root_remote" r ON r."root" = c."root"
LEFT JOIN "git_host_project" g ON g."remote" = c."root"
ORDER BY r."remote", g."synced_from" DESC NULLS LAST, r."root";--> statement-breakpoint
DELETE FROM "git_host_issue" i
  WHERE NOT EXISTS (SELECT 1 FROM "git_host_kept_root" k WHERE k."root" = i."remote");--> statement-breakpoint
DELETE FROM "git_host_request" q
  WHERE NOT EXISTS (SELECT 1 FROM "git_host_kept_root" k WHERE k."root" = q."remote");--> statement-breakpoint
DELETE FROM "git_host_project" g
  WHERE NOT EXISTS (SELECT 1 FROM "git_host_kept_root" k WHERE k."root" = g."remote");--> statement-breakpoint
UPDATE "git_host_issue" i SET "remote" = k."remote"
  FROM "git_host_kept_root" k WHERE k."root" = i."remote";--> statement-breakpoint
UPDATE "git_host_request" q SET "remote" = k."remote"
  FROM "git_host_kept_root" k WHERE k."root" = q."remote";--> statement-breakpoint
UPDATE "git_host_project" g SET "remote" = k."remote"
  FROM "git_host_kept_root" k WHERE k."root" = g."remote";--> statement-breakpoint
DROP TABLE "git_host_kept_root";
