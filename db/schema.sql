-- Tavor listing dashboard. Run with `npm run migrate` (needs DATABASE_URL); safe to re-run.

-- One realcommercial link and everything the pipeline learned about it.
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  status text not null default 'queued',          -- queued | running | ready | failed
  step text not null default 'scrape',            -- current or last pipeline step
  step_started_at timestamptz,
  error text,
  data jsonb not null default '{}'::jsonb,        -- scrape, facts, site, demographics, developments, sources ...
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The editable summary for a listing. fields = SummaryFields; current_version_id = what the designer shows.
create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  title text not null default '',
  fields jsonb,
  current_version_id uuid,
  share_slug text unique,
  shared_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists drafts_listing_idx on drafts(listing_id);

-- Every saved state of a draft's HTML: the generated original, each Claude edit, each manual edit.
create table if not exists versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  number int not null,
  html text not null,
  source text not null,                            -- generated | claude | details | restore | upload
  note text not null default '',
  created_by text,
  created_at timestamptz not null default now(),
  unique (draft_id, number)
);

-- Designer chat history, one row per message.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  role text not null,                              -- user | assistant
  content text not null,
  version_id uuid references versions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists chat_draft_idx on chat_messages(draft_id, created_at);

-- Images (listing photos, floor plans, aerials, development renders, uploads).
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade,
  kind text not null,                              -- photo | floorplan | aerial | development | upload
  mime text not null,
  bytes bytea not null,
  width int,
  height int,
  source_url text,
  created_at timestamptz not null default now()
);
create index if not exists assets_listing_idx on assets(listing_id);
