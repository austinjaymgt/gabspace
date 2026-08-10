-- Track last-touched time on projects and tasks so "stalled" project pulse
-- reflects actual edits (status changes, field updates), not just creation.

ALTER TABLE "public"."projects" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."tasks" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();

UPDATE "public"."projects" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "public"."tasks" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

CREATE OR REPLACE TRIGGER "projects_set_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE OR REPLACE TRIGGER "tasks_set_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
