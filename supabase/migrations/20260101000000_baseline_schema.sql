


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "public";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."workspace_role" AS ENUM (
    'owner',
    'admin',
    'member',
    'client',
    'employee'
);


ALTER TYPE "public"."workspace_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_intranet_role"() RETURNS "public"."workspace_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT role FROM user_profiles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'employee' THEN 1
    WHEN 'owner' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'member' THEN 4
    ELSE 5
  END
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_intranet_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"("ws_id" "uuid") RETURNS "public"."workspace_role"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT role FROM user_profiles
  WHERE user_id = auth.uid() AND workspace_id = ws_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_role"("ws_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_workspace_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT workspace_id 
  FROM user_profiles 
  WHERE user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_workspace_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_workspace_id uuid;
  ws_name text;
BEGIN
  -- Decide workspace name: use what they typed, else fall back
  ws_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'workspace_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '') || '''s Workspace',
    'My Workspace'
  );

  INSERT INTO public.workspaces (id, name, owner_id)
  VALUES (gen_random_uuid(), ws_name, NEW.id)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.user_profiles (user_id, workspace_id, role, display_name)
  VALUES (
    NEW.id,
    new_workspace_id,
    'owner',
    NEW.raw_user_meta_data->>'full_name'
  );

  INSERT INTO public.user_settings (user_id, onboarding_completed)
  VALUES (NEW.id, false);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_deletions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspaces_deleted" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "workspaces_left" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "reason" "text",
    "initiated_from" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."account_deletions" OWNER TO "postgres";


COMMENT ON TABLE "public"."account_deletions" IS 'Permanent audit log of account deletions for GDPR compliance. Service-role-only access.';



CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "tag" "text",
    "author_id" "uuid",
    "published_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "file_url" "text",
    "description" "text",
    "tags" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aura_state" (
    "user_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."aura_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beta_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "creative_type" "text",
    "social_link" "text",
    "how_heard" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."beta_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "budget_categories_type_check" CHECK (("type" = ANY (ARRAY['expense'::"text", 'income'::"text"])))
);


ALTER TABLE "public"."budget_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "category" "text" NOT NULL,
    "label" "text",
    "projected_amount" numeric DEFAULT 0,
    "actual_amount" numeric DEFAULT 0,
    "quarter" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "item_date" "date"
);


ALTER TABLE "public"."budget_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "event_type" "text" DEFAULT 'attending'::"text",
    "date" "date",
    "location" "text",
    "cost" numeric,
    "status" "text" DEFAULT 'upcoming'::"text",
    "goal_connections" integer,
    "goal_leads" integer,
    "goal_revenue" numeric,
    "goal_notes" "text",
    "actual_connections" integer,
    "actual_leads" integer,
    "actual_revenue" numeric,
    "outcome_notes" "text",
    "prep_checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_assets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "file_url" "text",
    "asset_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."campaign_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "name" "text" NOT NULL,
    "channel" "text",
    "budget" numeric,
    "spend" numeric DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "start_date" "date",
    "end_date" "date",
    "description" "text",
    "platform" "text",
    "goal" "text",
    "results" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "overall_goal" "text",
    "strategy_notes" "text",
    "quarter" "text",
    "year" integer DEFAULT 2026
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "company" "text",
    "email" "text",
    "phone" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_calendar" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "campaign_id" "uuid",
    "project_id" "uuid",
    "title" "text" NOT NULL,
    "platform" "text",
    "status" "text" DEFAULT 'idea'::"text",
    "scheduled_date" "date",
    "notes" "text",
    "media_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."content_calendar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliverable_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deliverable_id" "uuid" NOT NULL,
    "author_type" "text" DEFAULT 'client'::"text" NOT NULL,
    "author_name" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deliverable_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliverable_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deliverable_id" "uuid" NOT NULL,
    "client_token" "text" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deliverable_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliverables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "file_url" "text",
    "file_type" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deliverables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."department_budget" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "annual_budget" numeric DEFAULT 0,
    "q1_target" numeric DEFAULT 0,
    "q2_target" numeric DEFAULT 0,
    "q3_target" numeric DEFAULT 0,
    "q4_target" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."department_budget" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "event_id" "uuid",
    "name" "text" NOT NULL,
    "file_url" "text",
    "type" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "package_id" "uuid",
    "project_id" "uuid",
    "created_by" "uuid",
    "event_name" "text" NOT NULL,
    "event_type" "text",
    "event_date" "date",
    "venue" "text",
    "headcount" integer,
    "budget_tier" "text",
    "budget_amount" numeric DEFAULT 0,
    "vendor_notes" "text",
    "merch_notes" "text",
    "creative_notes" "text",
    "timeline_overrides" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_briefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "organization" "text",
    "event_type" "text",
    "event_date" "date",
    "guest_count" integer,
    "budget_range" "text",
    "venue" "text",
    "message" "text",
    "status" "text" DEFAULT 'new'::"text"
);


ALTER TABLE "public"."event_inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "name" "text" NOT NULL,
    "event_type" "text",
    "description" "text",
    "budget_low" numeric DEFAULT 0,
    "budget_mid" numeric DEFAULT 0,
    "budget_high" numeric DEFAULT 0,
    "headcount_min" integer DEFAULT 0,
    "headcount_max" integer DEFAULT 0,
    "vendor_categories" "jsonb" DEFAULT '[]'::"jsonb",
    "merch_notes" "text",
    "inspo_deck_url" "text",
    "inspo_deck_label" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_staffing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "person_name" "text",
    "status" "text" DEFAULT 'needed'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."event_staffing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_vendors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "role" "text",
    "status" "text" DEFAULT 'confirmed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."event_vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "workspace_id" "uuid",
    "name" "text" NOT NULL,
    "event_date" "date",
    "venue" "text",
    "guest_count" integer,
    "status" "text" DEFAULT 'planning'::"text",
    "runsheet" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "event_id" "uuid",
    "title" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "category" "text",
    "date" "date",
    "notes" "text",
    "recurrence" "text",
    "tax_category" "text",
    "receipt_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goal_subtasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "goal_subtasks_title_check" CHECK (("length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."goal_subtasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intranet_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


ALTER TABLE "public"."intranet_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."workspace_role" DEFAULT 'member'::"public"."workspace_role" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "accepted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "project_id" "uuid",
    "invoice_number" "text",
    "total_amount" numeric DEFAULT 0,
    "amount_paid" numeric DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "due_date" "date",
    "paid_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."line_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "description" "text",
    "quantity" numeric DEFAULT 1,
    "unit_price" numeric DEFAULT 0,
    "total" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "days_out" integer NOT NULL,
    "task" "text" NOT NULL,
    "owner_role" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."package_timeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "update_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "author_name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."portal_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(24), 'hex'::"text") NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'active'::"text" NOT NULL
);


ALTER TABLE "public"."portal_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portal_link_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "staff_last_viewed" timestamp with time zone
);


ALTER TABLE "public"."portal_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_reactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "update_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."portal_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_viewed_at" timestamp with time zone,
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."portal_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_updates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "message" "text" NOT NULL,
    "image_url" "text",
    "is_visible" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."portal_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pro_dev" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "member_name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" NOT NULL,
    "provider" "text",
    "status" "text" DEFAULT 'registered'::"text",
    "start_date" "date",
    "end_date" "date",
    "cost" numeric DEFAULT 0,
    "notes" "text",
    "certificate_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pro_dev" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_budget_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "projected_amount" numeric,
    "actual_amount" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."project_budget_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."project_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "target_date" "date",
    "status" "text" DEFAULT 'upcoming'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "show_in_portal" boolean DEFAULT false NOT NULL,
    CONSTRAINT "project_milestones_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'in_progress'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."project_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_vendors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "agreed_rate" numeric,
    "status" "text" DEFAULT 'confirmed'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."project_vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "start_date" "date",
    "end_date" "date",
    "budget" numeric,
    "type" "text",
    "notes" "text",
    "description" "text",
    "event_date" timestamp with time zone,
    "venue" "text",
    "headcount" integer,
    "event_status" "text" DEFAULT 'concept'::"text",
    "source" "text" DEFAULT 'internal'::"text",
    "concept_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "project_type" "text",
    "has_event_features" boolean DEFAULT false
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "url" "text",
    "file_path" "text",
    "file_name" "text",
    "file_size" bigint,
    "file_mime" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resources_kind_check" CHECK (("kind" = ANY (ARRAY['file'::"text", 'link'::"text"]))),
    CONSTRAINT "resources_kind_payload" CHECK (((("kind" = 'link'::"text") AND ("url" IS NOT NULL) AND ("file_path" IS NULL)) OR (("kind" = 'file'::"text") AND ("file_path" IS NOT NULL) AND ("url" IS NULL))))
);


ALTER TABLE "public"."resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revenue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "project_id" "uuid",
    "amount" numeric NOT NULL,
    "date" "date",
    "income_stream" "text" NOT NULL,
    "status" "text" DEFAULT 'received'::"text",
    "tax_category" "text",
    "notes" "text",
    "receipt_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."revenue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."run_of_show" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "role_label" "text",
    "notes" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL,
    "item_date" "date"
);


ALTER TABLE "public"."run_of_show" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "project_id" "uuid",
    "event_id" "uuid",
    "workspace_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'todo'::"text",
    "due_date" "date",
    "assigned_to" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "start_date" "date"
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "owner" "text",
    "period" "text" NOT NULL,
    "status" "text" DEFAULT 'not-started'::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text" DEFAULT 'team'::"text" NOT NULL,
    "category_label" "text",
    "start_date" "date",
    "due_date" "date",
    CONSTRAINT "team_goals_category_check" CHECK (("category" = ANY (ARRAY['team'::"text", 'business'::"text", 'personal'::"text", 'financial'::"text", 'marketing'::"text", 'other'::"text"]))),
    CONSTRAINT "team_goals_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "team_goals_status_check" CHECK (("status" = ANY (ARRAY['on-track'::"text", 'at-risk'::"text", 'completed'::"text", 'not-started'::"text"])))
);


ALTER TABLE "public"."team_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "role" "public"."workspace_role" DEFAULT 'member'::"public"."workspace_role" NOT NULL,
    "display_name" "text",
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "onboarding_complete" boolean DEFAULT false,
    "onboarding_completed_at" timestamp with time zone,
    "is_beta" boolean DEFAULT false
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_name" "text",
    "logo_url" "text",
    "favorites" "text"[] DEFAULT ARRAY['dashboard'::"text", 'allclients'::"text", 'projects'::"text"],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "onboarding_completed" boolean DEFAULT false,
    "display_name" "text",
    "job_title" "text"
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text",
    "email" "text",
    "phone" "text",
    "rate" numeric,
    "address" "text",
    "website" "text",
    "instagram" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."account_deletions"
    ADD CONSTRAINT "account_deletions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aura_state"
    ADD CONSTRAINT "aura_state_pkey" PRIMARY KEY ("user_id", "key");



ALTER TABLE ONLY "public"."beta_requests"
    ADD CONSTRAINT "beta_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_categories"
    ADD CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_categories"
    ADD CONSTRAINT "budget_categories_workspace_id_type_name_key" UNIQUE ("workspace_id", "type", "name");



ALTER TABLE ONLY "public"."budget_line_items"
    ADD CONSTRAINT "budget_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_events"
    ADD CONSTRAINT "business_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_assets"
    ADD CONSTRAINT "campaign_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_calendar"
    ADD CONSTRAINT "content_calendar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverable_comments"
    ADD CONSTRAINT "deliverable_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverable_reactions"
    ADD CONSTRAINT "deliverable_reactions_deliverable_id_client_token_emoji_key" UNIQUE ("deliverable_id", "client_token", "emoji");



ALTER TABLE ONLY "public"."deliverable_reactions"
    ADD CONSTRAINT "deliverable_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_budget"
    ADD CONSTRAINT "department_budget_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."department_budget"
    ADD CONSTRAINT "department_budget_workspace_id_year_key" UNIQUE ("workspace_id", "year");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_briefs"
    ADD CONSTRAINT "event_briefs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_inquiries"
    ADD CONSTRAINT "event_inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_packages"
    ADD CONSTRAINT "event_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_staffing"
    ADD CONSTRAINT "event_staffing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goal_subtasks"
    ADD CONSTRAINT "goal_subtasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intranet_config"
    ADD CONSTRAINT "intranet_config_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."intranet_config"
    ADD CONSTRAINT "intranet_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."line_items"
    ADD CONSTRAINT "line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_timeline"
    ADD CONSTRAINT "package_timeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_comments"
    ADD CONSTRAINT "portal_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_links"
    ADD CONSTRAINT "portal_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_links"
    ADD CONSTRAINT "portal_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."portal_projects"
    ADD CONSTRAINT "portal_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_projects"
    ADD CONSTRAINT "portal_projects_portal_link_id_project_id_key" UNIQUE ("portal_link_id", "project_id");



ALTER TABLE ONLY "public"."portal_reactions"
    ADD CONSTRAINT "portal_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_updates"
    ADD CONSTRAINT "portal_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pro_dev"
    ADD CONSTRAINT "pro_dev_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_budget_items"
    ADD CONSTRAINT "project_budget_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_milestones"
    ADD CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_vendors"
    ADD CONSTRAINT "project_vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revenue"
    ADD CONSTRAINT "revenue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."run_of_show"
    ADD CONSTRAINT "run_of_show_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_goals"
    ADD CONSTRAINT "team_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "goal_subtasks_goal_id_idx" ON "public"."goal_subtasks" USING "btree" ("goal_id");



CREATE INDEX "goal_subtasks_workspace_id_idx" ON "public"."goal_subtasks" USING "btree" ("workspace_id");



CREATE INDEX "idx_account_deletions_deleted_at" ON "public"."account_deletions" USING "btree" ("deleted_at" DESC);



CREATE INDEX "idx_account_deletions_user_id" ON "public"."account_deletions" USING "btree" ("user_id");



CREATE INDEX "idx_campaign_assets_workspace_id" ON "public"."campaign_assets" USING "btree" ("workspace_id");



CREATE INDEX "idx_event_staffing_workspace_id" ON "public"."event_staffing" USING "btree" ("workspace_id");



CREATE INDEX "idx_event_vendors_workspace_id" ON "public"."event_vendors" USING "btree" ("workspace_id");



CREATE INDEX "idx_project_budget_items_workspace_id" ON "public"."project_budget_items" USING "btree" ("workspace_id");



CREATE INDEX "idx_project_documents_workspace_id" ON "public"."project_documents" USING "btree" ("workspace_id");



CREATE INDEX "idx_project_vendors_workspace_id" ON "public"."project_vendors" USING "btree" ("workspace_id");



CREATE INDEX "idx_run_of_show_workspace_id" ON "public"."run_of_show" USING "btree" ("workspace_id");



CREATE INDEX "resources_created_at_idx" ON "public"."resources" USING "btree" ("created_at" DESC);



CREATE INDEX "resources_tags_gin_idx" ON "public"."resources" USING "gin" ("tags");



CREATE INDEX "resources_workspace_id_idx" ON "public"."resources" USING "btree" ("workspace_id");



CREATE INDEX "team_goals_workspace_idx" ON "public"."team_goals" USING "btree" ("workspace_id");



CREATE INDEX "team_goals_workspace_period_idx" ON "public"."team_goals" USING "btree" ("workspace_id", "period");



CREATE OR REPLACE TRIGGER "handle_goal_subtasks_updated_at" BEFORE UPDATE ON "public"."goal_subtasks" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"('updated_at');



-- The "on_beta_request_insert" database webhook (beta_requests -> notify-beta-request
-- edge function) is intentionally omitted here. It depends on the supabase_functions
-- schema, which isn't provisioned yet when a fresh branch replays migrations, and it's
-- managed through the Dashboard's Database Webhooks UI in production anyway, not SQL.



CREATE OR REPLACE TRIGGER "resources_set_updated_at" BEFORE UPDATE ON "public"."resources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "team_goals_updated_at" BEFORE UPDATE ON "public"."team_goals" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"('updated_at');



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."aura_state"
    ADD CONSTRAINT "aura_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_line_items"
    ADD CONSTRAINT "budget_line_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budget_line_items"
    ADD CONSTRAINT "budget_line_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_assets"
    ADD CONSTRAINT "campaign_assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_assets"
    ADD CONSTRAINT "campaign_assets_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_calendar"
    ADD CONSTRAINT "content_calendar_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."content_calendar"
    ADD CONSTRAINT "content_calendar_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deliverable_comments"
    ADD CONSTRAINT "deliverable_comments_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_reactions"
    ADD CONSTRAINT "deliverable_reactions_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."department_budget"
    ADD CONSTRAINT "department_budget_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_briefs"
    ADD CONSTRAINT "event_briefs_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."event_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_briefs"
    ADD CONSTRAINT "event_briefs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_briefs"
    ADD CONSTRAINT "event_briefs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_packages"
    ADD CONSTRAINT "event_packages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_staffing"
    ADD CONSTRAINT "event_staffing_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_staffing"
    ADD CONSTRAINT "event_staffing_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_vendors"
    ADD CONSTRAINT "event_vendors_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goal_subtasks"
    ADD CONSTRAINT "goal_subtasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."team_goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goal_subtasks"
    ADD CONSTRAINT "goal_subtasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."intranet_config"
    ADD CONSTRAINT "intranet_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."line_items"
    ADD CONSTRAINT "line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."package_timeline"
    ADD CONSTRAINT "package_timeline_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."event_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_comments"
    ADD CONSTRAINT "portal_comments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_comments"
    ADD CONSTRAINT "portal_comments_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "public"."portal_updates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_links"
    ADD CONSTRAINT "portal_links_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_projects"
    ADD CONSTRAINT "portal_projects_portal_link_id_fkey" FOREIGN KEY ("portal_link_id") REFERENCES "public"."portal_links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_projects"
    ADD CONSTRAINT "portal_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_reactions"
    ADD CONSTRAINT "portal_reactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_reactions"
    ADD CONSTRAINT "portal_reactions_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "public"."portal_updates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_tokens"
    ADD CONSTRAINT "portal_tokens_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_updates"
    ADD CONSTRAINT "portal_updates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_updates"
    ADD CONSTRAINT "portal_updates_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pro_dev"
    ADD CONSTRAINT "pro_dev_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_budget_items"
    ADD CONSTRAINT "project_budget_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_budget_items"
    ADD CONSTRAINT "project_budget_items_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_documents"
    ADD CONSTRAINT "project_documents_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_milestones"
    ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_vendors"
    ADD CONSTRAINT "project_vendors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_vendors"
    ADD CONSTRAINT "project_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_vendors"
    ADD CONSTRAINT "project_vendors_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revenue"
    ADD CONSTRAINT "revenue_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."revenue"
    ADD CONSTRAINT "revenue_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."run_of_show"
    ADD CONSTRAINT "run_of_show_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."run_of_show"
    ADD CONSTRAINT "run_of_show_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_goals"
    ADD CONSTRAINT "team_goals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can submit a beta request" ON "public"."beta_requests" FOR INSERT TO "anon" WITH CHECK (true);



ALTER TABLE "public"."account_deletions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "announcements_delete" ON "public"."announcements" FOR DELETE USING (("public"."get_my_intranet_role"() = 'owner'::"public"."workspace_role"));



CREATE POLICY "announcements_insert" ON "public"."announcements" FOR INSERT WITH CHECK (("public"."get_my_intranet_role"() = ANY (ARRAY['admin'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));



CREATE POLICY "announcements_select" ON "public"."announcements" FOR SELECT USING (("public"."get_my_intranet_role"() = ANY (ARRAY['employee'::"public"."workspace_role", 'member'::"public"."workspace_role", 'admin'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));



CREATE POLICY "announcements_update" ON "public"."announcements" FOR UPDATE USING (("public"."get_my_intranet_role"() = ANY (ARRAY['admin'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));



CREATE POLICY "anyone can comment" ON "public"."deliverable_comments" USING (true);



CREATE POLICY "anyone can react" ON "public"."deliverable_reactions" USING (true);



ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assets_all" ON "public"."assets" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."aura_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beta_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beta_requests_all" ON "public"."beta_requests" USING (("public"."get_my_role"(( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."role" = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role", 'member'::"public"."workspace_role"])))
 LIMIT 1)) = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role", 'member'::"public"."workspace_role"]))) WITH CHECK (("public"."get_my_role"(( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."user_id" = "auth"."uid"()) AND ("user_profiles"."role" = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role", 'member'::"public"."workspace_role"])))
 LIMIT 1)) = ANY (ARRAY['owner'::"public"."workspace_role", 'admin'::"public"."workspace_role", 'member'::"public"."workspace_role"])));



CREATE POLICY "budget_all" ON "public"."department_budget" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."budget_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budget_line_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_line_items_all" ON "public"."budget_line_items" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."business_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "business_events_all" ON "public"."business_events" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."campaign_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_assets_all" ON "public"."campaign_assets" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaigns_all" ON "public"."campaigns" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_all" ON "public"."clients" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contacts_all" ON "public"."contacts" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."content_calendar" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_calendar_all" ON "public"."content_calendar" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."deliverable_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deliverable_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deliverables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."department_budget" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_all" ON "public"."documents" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."event_briefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_briefs_all" ON "public"."event_briefs" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."event_inquiries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_inquiries_delete" ON "public"."event_inquiries" FOR DELETE USING (false);



CREATE POLICY "event_inquiries_insert" ON "public"."event_inquiries" FOR INSERT WITH CHECK (false);



CREATE POLICY "event_inquiries_select" ON "public"."event_inquiries" FOR SELECT USING (false);



CREATE POLICY "event_inquiries_update" ON "public"."event_inquiries" FOR UPDATE USING (false);



ALTER TABLE "public"."event_packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_packages_all" ON "public"."event_packages" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."event_staffing" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_staffing_all" ON "public"."event_staffing" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."event_vendors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_vendors_all" ON "public"."event_vendors" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_all" ON "public"."events" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_all" ON "public"."expenses" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."goal_subtasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goal_subtasks_all" ON "public"."goal_subtasks" USING (("workspace_id" IN ( SELECT "public"."get_my_workspace_ids"() AS "get_my_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."get_my_workspace_ids"() AS "get_my_workspace_ids")));



ALTER TABLE "public"."intranet_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "intranet_config_insert" ON "public"."intranet_config" FOR INSERT WITH CHECK (("public"."get_my_intranet_role"() = ANY (ARRAY['admin'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));



CREATE POLICY "intranet_config_select" ON "public"."intranet_config" FOR SELECT USING (("public"."get_my_intranet_role"() = ANY (ARRAY['employee'::"public"."workspace_role", 'member'::"public"."workspace_role", 'admin'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));



CREATE POLICY "intranet_config_update" ON "public"."intranet_config" FOR UPDATE USING (("public"."get_my_intranet_role"() = ANY (ARRAY['admin'::"public"."workspace_role", 'owner'::"public"."workspace_role"])));



ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invites_insert" ON "public"."invites" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "workspaces"."id"
   FROM "public"."workspaces"
  WHERE ("workspaces"."owner_id" = "auth"."uid"()))));



CREATE POLICY "invites_select" ON "public"."invites" FOR SELECT USING ((("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))) OR ("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text")));



CREATE POLICY "invites_update" ON "public"."invites" FOR UPDATE USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_all" ON "public"."invoices" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."line_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "line_items_all" ON "public"."line_items" USING (("invoice_id" IN ( SELECT "invoices"."id"
   FROM "public"."invoices"
  WHERE ("invoices"."workspace_id" IN ( SELECT "user_profiles"."workspace_id"
           FROM "public"."user_profiles"
          WHERE ("user_profiles"."user_id" = "auth"."uid"())))))) WITH CHECK (("invoice_id" IN ( SELECT "invoices"."id"
   FROM "public"."invoices"
  WHERE ("invoices"."workspace_id" IN ( SELECT "user_profiles"."workspace_id"
           FROM "public"."user_profiles"
          WHERE ("user_profiles"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notes_all" ON "public"."notes" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "own delete" ON "public"."aura_state" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own insert" ON "public"."aura_state" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "own select" ON "public"."aura_state" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "own update" ON "public"."aura_state" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."package_timeline" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "package_timeline_all" ON "public"."package_timeline" USING (("package_id" IN ( SELECT "event_packages"."id"
   FROM "public"."event_packages"
  WHERE ("event_packages"."workspace_id" IN ( SELECT "user_profiles"."workspace_id"
           FROM "public"."user_profiles"
          WHERE ("user_profiles"."user_id" = "auth"."uid"())))))) WITH CHECK (("package_id" IN ( SELECT "event_packages"."id"
   FROM "public"."event_packages"
  WHERE ("event_packages"."workspace_id" IN ( SELECT "user_profiles"."workspace_id"
           FROM "public"."user_profiles"
          WHERE ("user_profiles"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."portal_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_comments_locked" ON "public"."portal_comments" USING (false) WITH CHECK (false);



ALTER TABLE "public"."portal_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portal_projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portal_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_reactions_locked" ON "public"."portal_reactions" USING (false) WITH CHECK (false);



ALTER TABLE "public"."portal_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_tokens_all" ON "public"."portal_tokens" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "portal_tokens_locked" ON "public"."portal_tokens" USING (false) WITH CHECK (false);



ALTER TABLE "public"."portal_updates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_updates_all" ON "public"."portal_updates" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "portal_updates_locked" ON "public"."portal_updates" USING (false) WITH CHECK (false);



ALTER TABLE "public"."pro_dev" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pro_dev_all" ON "public"."pro_dev" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "profiles_insert" ON "public"."user_profiles" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_select" ON "public"."user_profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_update" ON "public"."user_profiles" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."project_budget_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_budget_items_all" ON "public"."project_budget_items" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."project_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_documents_all" ON "public"."project_documents" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."project_milestones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_milestones_all" ON "public"."project_milestones" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."project_vendors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_vendors_all" ON "public"."project_vendors" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_all" ON "public"."projects" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resources_delete" ON "public"."resources" FOR DELETE USING (("workspace_id" IN ( SELECT "public"."get_my_workspace_ids"() AS "get_my_workspace_ids")));



CREATE POLICY "resources_insert" ON "public"."resources" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "public"."get_my_workspace_ids"() AS "get_my_workspace_ids")));



CREATE POLICY "resources_select" ON "public"."resources" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."get_my_workspace_ids"() AS "get_my_workspace_ids")));



CREATE POLICY "resources_update" ON "public"."resources" FOR UPDATE USING (("workspace_id" IN ( SELECT "public"."get_my_workspace_ids"() AS "get_my_workspace_ids"))) WITH CHECK (("workspace_id" IN ( SELECT "public"."get_my_workspace_ids"() AS "get_my_workspace_ids")));



ALTER TABLE "public"."revenue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "revenue_all" ON "public"."revenue" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."run_of_show" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "run_of_show_all" ON "public"."run_of_show" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "same_workspace_profiles_select" ON "public"."user_profiles" FOR SELECT USING (("workspace_id" IN ( SELECT "public"."get_my_workspace_ids"() AS "get_my_workspace_ids")));



CREATE POLICY "settings_all" ON "public"."user_settings" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_all" ON "public"."tasks" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."team_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_goals_all" ON "public"."team_goals" TO "authenticated" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vendors_all" ON "public"."vendors" USING (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))) WITH CHECK (("workspace_id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "workspace members manage budget_categories" ON "public"."budget_categories" USING (true);



CREATE POLICY "workspace members manage deliverables" ON "public"."deliverables" USING (true);



CREATE POLICY "workspace members manage portal_links" ON "public"."portal_links" USING (true);



CREATE POLICY "workspace members manage portal_projects" ON "public"."portal_projects" USING (true);



CREATE POLICY "workspace_insert" ON "public"."workspaces" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "workspace_select" ON "public"."workspaces" FOR SELECT USING ((("owner_id" = "auth"."uid"()) OR ("id" IN ( SELECT "user_profiles"."workspace_id"
   FROM "public"."user_profiles"
  WHERE ("user_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "workspace_update" ON "public"."workspaces" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_intranet_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_intranet_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_intranet_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"("ws_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"("ws_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"("ws_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_workspace_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_workspace_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_workspace_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."account_deletions" TO "anon";
GRANT ALL ON TABLE "public"."account_deletions" TO "authenticated";
GRANT ALL ON TABLE "public"."account_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON TABLE "public"."aura_state" TO "anon";
GRANT ALL ON TABLE "public"."aura_state" TO "authenticated";
GRANT ALL ON TABLE "public"."aura_state" TO "service_role";



GRANT ALL ON TABLE "public"."beta_requests" TO "anon";
GRANT ALL ON TABLE "public"."beta_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."beta_requests" TO "service_role";



GRANT ALL ON TABLE "public"."budget_categories" TO "anon";
GRANT ALL ON TABLE "public"."budget_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_categories" TO "service_role";



GRANT ALL ON TABLE "public"."budget_line_items" TO "anon";
GRANT ALL ON TABLE "public"."budget_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."business_events" TO "anon";
GRANT ALL ON TABLE "public"."business_events" TO "authenticated";
GRANT ALL ON TABLE "public"."business_events" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_assets" TO "anon";
GRANT ALL ON TABLE "public"."campaign_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_assets" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."content_calendar" TO "anon";
GRANT ALL ON TABLE "public"."content_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."content_calendar" TO "service_role";



GRANT ALL ON TABLE "public"."deliverable_comments" TO "anon";
GRANT ALL ON TABLE "public"."deliverable_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverable_comments" TO "service_role";



GRANT ALL ON TABLE "public"."deliverable_reactions" TO "anon";
GRANT ALL ON TABLE "public"."deliverable_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverable_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."deliverables" TO "anon";
GRANT ALL ON TABLE "public"."deliverables" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverables" TO "service_role";



GRANT ALL ON TABLE "public"."department_budget" TO "anon";
GRANT ALL ON TABLE "public"."department_budget" TO "authenticated";
GRANT ALL ON TABLE "public"."department_budget" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."event_briefs" TO "anon";
GRANT ALL ON TABLE "public"."event_briefs" TO "authenticated";
GRANT ALL ON TABLE "public"."event_briefs" TO "service_role";



GRANT ALL ON TABLE "public"."event_inquiries" TO "anon";
GRANT ALL ON TABLE "public"."event_inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."event_inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."event_packages" TO "anon";
GRANT ALL ON TABLE "public"."event_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."event_packages" TO "service_role";



GRANT ALL ON TABLE "public"."event_staffing" TO "anon";
GRANT ALL ON TABLE "public"."event_staffing" TO "authenticated";
GRANT ALL ON TABLE "public"."event_staffing" TO "service_role";



GRANT ALL ON TABLE "public"."event_vendors" TO "anon";
GRANT ALL ON TABLE "public"."event_vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."event_vendors" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."goal_subtasks" TO "anon";
GRANT ALL ON TABLE "public"."goal_subtasks" TO "authenticated";
GRANT ALL ON TABLE "public"."goal_subtasks" TO "service_role";



GRANT ALL ON TABLE "public"."intranet_config" TO "anon";
GRANT ALL ON TABLE "public"."intranet_config" TO "authenticated";
GRANT ALL ON TABLE "public"."intranet_config" TO "service_role";



GRANT ALL ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT ALL ON TABLE "public"."invites" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."line_items" TO "anon";
GRANT ALL ON TABLE "public"."line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."line_items" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."package_timeline" TO "anon";
GRANT ALL ON TABLE "public"."package_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."package_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."portal_comments" TO "anon";
GRANT ALL ON TABLE "public"."portal_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_comments" TO "service_role";



GRANT ALL ON TABLE "public"."portal_links" TO "anon";
GRANT ALL ON TABLE "public"."portal_links" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_links" TO "service_role";



GRANT ALL ON TABLE "public"."portal_projects" TO "anon";
GRANT ALL ON TABLE "public"."portal_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_projects" TO "service_role";



GRANT ALL ON TABLE "public"."portal_reactions" TO "anon";
GRANT ALL ON TABLE "public"."portal_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."portal_tokens" TO "anon";
GRANT ALL ON TABLE "public"."portal_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."portal_updates" TO "anon";
GRANT ALL ON TABLE "public"."portal_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_updates" TO "service_role";



GRANT ALL ON TABLE "public"."pro_dev" TO "anon";
GRANT ALL ON TABLE "public"."pro_dev" TO "authenticated";
GRANT ALL ON TABLE "public"."pro_dev" TO "service_role";



GRANT ALL ON TABLE "public"."project_budget_items" TO "anon";
GRANT ALL ON TABLE "public"."project_budget_items" TO "authenticated";
GRANT ALL ON TABLE "public"."project_budget_items" TO "service_role";



GRANT ALL ON TABLE "public"."project_documents" TO "anon";
GRANT ALL ON TABLE "public"."project_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."project_documents" TO "service_role";



GRANT ALL ON TABLE "public"."project_milestones" TO "anon";
GRANT ALL ON TABLE "public"."project_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."project_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."project_vendors" TO "anon";
GRANT ALL ON TABLE "public"."project_vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."project_vendors" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."resources" TO "anon";
GRANT ALL ON TABLE "public"."resources" TO "authenticated";
GRANT ALL ON TABLE "public"."resources" TO "service_role";



GRANT ALL ON TABLE "public"."revenue" TO "anon";
GRANT ALL ON TABLE "public"."revenue" TO "authenticated";
GRANT ALL ON TABLE "public"."revenue" TO "service_role";



GRANT ALL ON TABLE "public"."run_of_show" TO "anon";
GRANT ALL ON TABLE "public"."run_of_show" TO "authenticated";
GRANT ALL ON TABLE "public"."run_of_show" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_goals" TO "anon";
GRANT ALL ON TABLE "public"."team_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."team_goals" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







