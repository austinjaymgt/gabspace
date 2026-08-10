-- Extend "last touched" tracking to the other project sections (milestones,
-- budget, documents, and event-feature staffing/run-of-show) so editing any
-- of them also counts as project activity, not just tasks or the project row.

ALTER TABLE "public"."project_milestones" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."project_budget_items" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."project_documents" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."run_of_show" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();
ALTER TABLE "public"."event_staffing" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();

UPDATE "public"."project_milestones" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "public"."project_budget_items" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "public"."project_documents" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "public"."run_of_show" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "public"."event_staffing" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

CREATE OR REPLACE TRIGGER "project_milestones_set_updated_at" BEFORE UPDATE ON "public"."project_milestones" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE OR REPLACE TRIGGER "project_budget_items_set_updated_at" BEFORE UPDATE ON "public"."project_budget_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE OR REPLACE TRIGGER "project_documents_set_updated_at" BEFORE UPDATE ON "public"."project_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE OR REPLACE TRIGGER "run_of_show_set_updated_at" BEFORE UPDATE ON "public"."run_of_show" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE OR REPLACE TRIGGER "event_staffing_set_updated_at" BEFORE UPDATE ON "public"."event_staffing" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
