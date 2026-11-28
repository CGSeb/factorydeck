INSERT INTO "project_rule" ("project_id", "kind", "position", "name", "description")
SELECT p."id", 'role', d."position", d."name", d."description"
FROM "project" p
CROSS JOIN (VALUES
	(0, 'builder', '^(Build|Worker for) '),
	(1, 'reviewer', '^Review '),
	(2, 'shipper', '^(Ship|Merge|Push) '),
	(3, 'reworker', '^(Rework|Rebase|Update) '),
	(4, 'spec-checker', 'check-spec'),
	(5, 'debugger', '^Debug '),
	(6, 'bug-checker', 'check-bug')
) AS d("position", "name", "description");
