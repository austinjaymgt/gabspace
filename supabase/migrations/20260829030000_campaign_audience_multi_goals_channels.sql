-- Remove event linkage from campaigns (campaigns are no longer attached to events)
alter table "public"."campaigns" drop column if exists "project_id";

-- Add audience field
alter table "public"."campaigns"
  add column if not exists "audience" text;

-- Support multiple channels/platforms instead of a single value each
alter table "public"."campaigns"
  add column if not exists "channels" text[] not null default '{}'::text[],
  add column if not exists "platforms" text[] not null default '{}'::text[];

update "public"."campaigns" set "channels" = array[channel] where channel is not null and channel <> '';
update "public"."campaigns" set "platforms" = array[platform] where platform is not null and platform <> '';

alter table "public"."campaigns" drop column if exists "channel";
alter table "public"."campaigns" drop column if exists "platform";

-- Support multiple trackable goals per campaign, replacing the single goal_target/goal_current/goal_unit fields
create table if not exists "public"."campaign_goals" (
  "id" uuid primary key default gen_random_uuid(),
  "campaign_id" uuid not null references "public"."campaigns"("id") on delete cascade,
  "business_space_id" uuid not null,
  "label" text,
  "target" numeric not null,
  "current" numeric not null default 0,
  "unit" text,
  "created_at" timestamptz not null default now()
);

create index if not exists idx_campaign_goals_campaign_id on "public"."campaign_goals" ("campaign_id");

insert into "public"."campaign_goals" ("campaign_id", "business_space_id", "target", "current", "unit")
select "id", "business_space_id", "goal_target", coalesce("goal_current", 0), "goal_unit"
from "public"."campaigns"
where "goal_target" is not null;

alter table "public"."campaigns" drop column if exists "goal_target";
alter table "public"."campaigns" drop column if exists "goal_current";
alter table "public"."campaigns" drop column if exists "goal_unit";

alter table "public"."campaign_goals" enable row level security;

create policy "campaign_goals_all" on "public"."campaign_goals"
  using ("business_space_id" in (select "user_profiles"."business_space_id" from "public"."user_profiles" where "user_profiles"."user_id" = "auth"."uid"()))
  with check ("business_space_id" in (select "user_profiles"."business_space_id" from "public"."user_profiles" where "user_profiles"."user_id" = "auth"."uid"()));

grant all on table "public"."campaign_goals" to "anon";
grant all on table "public"."campaign_goals" to "authenticated";
grant all on table "public"."campaign_goals" to "service_role";
