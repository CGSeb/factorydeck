-- Custom SQL migration file, put your code below! --
DELETE FROM "api_call" a USING "api_call" b
  WHERE b."session_id" = a."session_id"
    AND coalesce(b."sub_agent_id", '/') = coalesce(a."sub_agent_id", '/')
    AND b."request_key" = a."request_key"
    AND b."id" < a."id";--> statement-breakpoint
UPDATE "api_call" a
  SET "source_path" = s."agent" || '/' || a."session_id" || '/' || coalesce(a."sub_agent_id", 'main')
  FROM "session" s WHERE s."id" = a."session_id";--> statement-breakpoint
DELETE FROM "skill_launch" a USING "skill_launch" b
  WHERE b."session_id" = a."session_id"
    AND coalesce(b."sub_agent_id", '/') = coalesce(a."sub_agent_id", '/')
    AND b."record_uuid" = a."record_uuid"
    AND b."skill" = a."skill"
    AND b."id" < a."id";--> statement-breakpoint
UPDATE "skill_launch" a
  SET "source_path" = s."agent" || '/' || a."session_id" || '/' || coalesce(a."sub_agent_id", 'main')
  FROM "session" s WHERE s."id" = a."session_id";--> statement-breakpoint
DELETE FROM "user_prompt" a USING "user_prompt" b
  WHERE b."session_id" = a."session_id"
    AND b."record_uuid" = a."record_uuid"
    AND b."id" < a."id";--> statement-breakpoint
UPDATE "user_prompt" a
  SET "source_path" = s."agent" || '/' || a."session_id" || '/main'
  FROM "session" s WHERE s."id" = a."session_id";--> statement-breakpoint
DELETE FROM "closing_line" a USING "closing_line" b
  WHERE b."session_id" = a."session_id"
    AND b."record_uuid" = a."record_uuid"
    AND b."id" < a."id";--> statement-breakpoint
UPDATE "closing_line" a
  SET "source_path" = s."agent" || '/' || a."session_id" || '/main'
  FROM "session" s WHERE s."id" = a."session_id";
