-- Run once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run.

create table if not exists public.profiles (
  user_id        text primary key,          -- Clerk user id
  first_name     text,
  location       text,
  headline       text,
  cv_summary     text,
  cv_path        text,
  cv_uploaded_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Public one-liner for the Library card, regenerated after each upload.
alter table public.profiles add column if not exists superpower text;

-- Only the server (service role key) reads/writes; no public access.
alter table public.profiles enable row level security;

insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;

create table if not exists public.ai_sessions (
  user_id     text not null,
  slot        int not null check (slot between 1 and 3),
  title       text,
  summary     text,
  rating      int check (rating between 1 and 5),
  file_path   text,
  uploaded_at timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table public.ai_sessions add column if not exists rating int check (rating between 1 and 5);

alter table public.ai_sessions enable row level security;

insert into storage.buckets (id, name, public)
values ('ai-sessions', 'ai-sessions', false)
on conflict (id) do nothing;

-- One row per score change, so users can see how and why their score moved.
create table if not exists public.score_events (
  id           bigint generated always as identity primary key,
  user_id      text not null,
  created_at   timestamptz not null default now(),
  event        text not null,
  detail       text,
  reason       text,
  score_before int not null,
  score_after  int not null
);

-- The exact file behind each change, so users can reopen it from history.
alter table public.score_events add column if not exists bucket text;
alter table public.score_events add column if not exists file_path text;
alter table public.score_events add column if not exists summary text;

-- One Stellar testnet wallet per user. The secret is AES-256-GCM encrypted by the app.
create table if not exists public.wallets (
  user_id     text primary key,
  public_key  text not null unique,
  secret_enc  text not null,
  funded      boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.wallets enable row level security;

-- One "Claim 100 ACDC" per user; the primary key blocks double claims.
create table if not exists public.token_claims (
  user_id    text primary key,
  tx_hash    text,
  created_at timestamptz not null default now()
);

alter table public.token_claims enable row level security;

-- Whether the user lets their AI agent move their ACDC, and how much per 24h.
create table if not exists public.agent_settings (
  user_id     text primary key,
  enabled     boolean not null default false,
  daily_limit numeric not null default 20 check (daily_limit >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.agent_settings enable row level security;

-- Everything the agent did (or refused to do) on the user's behalf.
create table if not exists public.agent_actions (
  id           bigint generated always as identity primary key,
  user_id      text not null,
  created_at   timestamptz not null default now(),
  kind         text not null,  -- enabled | disabled | limit_changed | payment_sent | payment_received | payment_blocked
  amount       numeric,
  counterparty text,
  tx_hash      text,
  note         text
);

-- The user's 1-of-1 profile NFT on Stellar, and what's currently written on-chain for it.
create table if not exists public.profile_nfts (
  user_id       text primary key,
  asset_code    text not null unique,
  mint_tx       text,
  last_tx       text,
  onchain_score int,
  content_hash  text,
  updated_at    timestamptz not null default now()
);

alter table public.profile_nfts enable row level security;

-- Every distinct thing a user has been credited for building (the basis of the score).
-- Deduplicated by the AI at upload time, so re-uploading the same work adds nothing.
create table if not exists public.contributions (
  id          bigint generated always as identity primary key,
  user_id     text not null,
  created_at  timestamptz not null default now(),
  title       text not null,
  category    text,
  weight      int not null check (weight between 1 and 3),
  evidence    text,
  file_path   text
);

create index if not exists contributions_user_idx on public.contributions (user_id, created_at);

alter table public.contributions enable row level security;

-- Price (in ACDC) the owner charges to unlock their full profile.
alter table public.profiles add column if not exists access_price numeric not null default 10 check (access_price >= 0);

-- Who paid to unlock whose profile. Access is permanent; the unique pair blocks paying twice.
create table if not exists public.access_grants (
  id           bigint generated always as identity primary key,
  owner_id     text not null,
  requester_id text not null,
  price        numeric not null,
  tx_hash      text,
  created_at   timestamptz not null default now(),
  unique (owner_id, requester_id)
);

alter table public.access_grants enable row level security;

-- Links each score change to the on-chain NFT update it caused.
alter table public.score_events add column if not exists nft_tx text;

create index if not exists agent_actions_user_idx on public.agent_actions (user_id, created_at desc);

alter table public.agent_actions enable row level security;

create index if not exists score_events_user_idx on public.score_events (user_id, created_at desc);

alter table public.score_events enable row level security;
