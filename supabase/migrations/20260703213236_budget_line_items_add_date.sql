-- budget_line_items was missing a real date column; the app code has expected
-- item_date (to derive quarter + scope items to a year) for a while, but the
-- table was never migrated to add it — existing rows just get item_date = null.
alter table budget_line_items add column if not exists item_date date;
