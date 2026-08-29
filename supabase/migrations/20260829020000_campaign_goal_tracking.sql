alter table "public"."campaigns"
  add column if not exists "goal_target" numeric,
  add column if not exists "goal_current" numeric default 0,
  add column if not exists "goal_unit" text;
