-- Portal links: one per client, replaces portal_tokens for portal management
create table if not exists portal_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  workspace_id uuid not null,
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz default now()
);

-- Which projects are surfaced in a portal
create table if not exists portal_projects (
  id uuid primary key default gen_random_uuid(),
  portal_link_id uuid references portal_links(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(portal_link_id, project_id)
);

-- Deliverables attached to projects (visible in portal)
create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  workspace_id uuid not null,
  name text not null,
  description text,
  file_url text,
  file_type text, -- 'image' | 'pdf' | 'video' | 'link' | 'other'
  status text not null default 'draft', -- 'draft' | 'pending_review' | 'approved'
  created_at timestamptz default now()
);

-- Client comments on deliverables
create table if not exists deliverable_comments (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid references deliverables(id) on delete cascade not null,
  author_type text not null default 'client', -- 'staff' | 'client'
  author_name text not null,
  body text not null,
  created_at timestamptz default now()
);

-- Client reactions on deliverables
create table if not exists deliverable_reactions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid references deliverables(id) on delete cascade not null,
  client_token text not null, -- portal token used as anonymous identity
  emoji text not null,
  created_at timestamptz default now(),
  unique(deliverable_id, client_token, emoji)
);

-- RLS: portal_links readable by workspace members
alter table portal_links enable row level security;
alter table portal_projects enable row level security;
alter table deliverables enable row level security;
alter table deliverable_comments enable row level security;
alter table deliverable_reactions enable row level security;

-- Permissive policies (tighten per your RLS setup)
create policy "workspace members manage portal_links" on portal_links for all using (true);
create policy "workspace members manage portal_projects" on portal_projects for all using (true);
create policy "workspace members manage deliverables" on deliverables for all using (true);
create policy "anyone can comment" on deliverable_comments for all using (true);
create policy "anyone can react" on deliverable_reactions for all using (true);
