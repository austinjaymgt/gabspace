-- User-editable budget categories (replaces hardcoded category lists on the Department Budget page)
create table if not exists budget_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  type text not null check (type in ('expense', 'income')),
  name text not null,
  position int not null default 0,
  created_at timestamptz default now(),
  unique (workspace_id, type, name)
);

alter table budget_categories enable row level security;

create policy "workspace members manage budget_categories" on budget_categories for all using (true);
