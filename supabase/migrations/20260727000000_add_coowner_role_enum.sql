-- New business-management tier alongside Owner. Added in its own migration
-- because Postgres won't let a new enum value be added and used in the same
-- transaction — the data migration and everything that references
-- 'co-owner' lives in the next migration file instead.
ALTER TYPE public.workspace_role ADD VALUE IF NOT EXISTS 'co-owner';
