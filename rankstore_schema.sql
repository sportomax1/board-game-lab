-- ═══════════════════════════════════════════════════════════════════════════
-- RankStore Pro — Clean Schema (all tables prefixed rank_)
-- Run in Supabase SQL Editor.  Fully idempotent — safe to re-run.
--
-- Tables
--   rank_games    one row per BGG game (metadata cache)
--   rank_current  one row per game — always the latest known rank
--   rank_periods  SCD-2 history — one row per unchanged rank stretch
--   rank_runs     one row per sync attempt
--
-- The old rank_history table is intentionally left untouched.
--
-- MIGRATION NOTE
--   If you have an existing rank_runs table with a UUID primary key run:
--     alter table public.rank_runs rename to rank_runs_legacy;
--   before executing this script.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── rank_games ─────────────────────────────────────────────────────────────
-- Lightweight game-metadata cache. One row per BGG game.
create table if not exists public.rank_games (
  bgg_id        bigint       primary key,
  game_name     text         not null,
  thumbnail_url text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- ─── rank_current ───────────────────────────────────────────────────────────
-- Always reflects the latest known rank for every tracked game.
-- One row per game. Updated in-place every sync.
create table if not exists public.rank_current (
  bgg_id          bigint       primary key,
  game_name       text,
  bgg_rank        int,
  last_checked_at timestamptz,
  updated_at      timestamptz  not null default now()
);

-- ─── rank_periods ───────────────────────────────────────────────────────────
-- Efficient rank history. A new row is written ONLY when a rank changes.
-- valid_to IS NULL  → period is currently active.
-- valid_to NOT NULL → period has ended (rank changed or game unranked).
create table if not exists public.rank_periods (
  id         bigint       generated always as identity primary key,
  bgg_id     bigint       not null,
  game_name  text,
  bgg_rank   int,
  valid_from timestamptz  not null,
  valid_to   timestamptz,
  created_at timestamptz  not null default now()
);

-- Enforce exactly one active period per game at any time.
create unique index if not exists rank_periods_one_active_per_game
  on public.rank_periods (bgg_id)
  where valid_to is null;

create index if not exists rank_periods_bgg_id_idx
  on public.rank_periods (bgg_id);

create index if not exists rank_periods_valid_from_idx
  on public.rank_periods (valid_from desc);

-- ─── rank_runs ──────────────────────────────────────────────────────────────
-- One row per sync attempt with result counters.
create table if not exists public.rank_runs (
  id              bigint       generated always as identity primary key,
  username        text,
  started_at      timestamptz  not null default now(),
  finished_at     timestamptz,
  checked_count   int          not null default 0,
  ranked_count    int          not null default 0,
  inserted_count  int          not null default 0,
  changed_count   int          not null default 0,
  unchanged_count int          not null default 0,
  status          text,
  notes           text
);

create index if not exists rank_runs_username_idx
  on public.rank_runs (username);

create index if not exists rank_runs_started_at_idx
  on public.rank_runs (started_at desc);

-- ─── Row-Level Security ─────────────────────────────────────────────────────
alter table public.rank_games    enable row level security;
alter table public.rank_current  enable row level security;
alter table public.rank_periods  enable row level security;
alter table public.rank_runs     enable row level security;

-- rank_games
drop policy if exists "rank_games public select" on public.rank_games;
create policy "rank_games public select"
  on public.rank_games for select to anon, authenticated using (true);
drop policy if exists "rank_games public insert" on public.rank_games;
create policy "rank_games public insert"
  on public.rank_games for insert to anon, authenticated with check (true);
drop policy if exists "rank_games public update" on public.rank_games;
create policy "rank_games public update"
  on public.rank_games for update to anon, authenticated using (true) with check (true);
drop policy if exists "rank_games public delete" on public.rank_games;
create policy "rank_games public delete"
  on public.rank_games for delete to anon, authenticated using (true);

-- rank_current
drop policy if exists "rank_current public select" on public.rank_current;
create policy "rank_current public select"
  on public.rank_current for select to anon, authenticated using (true);
drop policy if exists "rank_current public insert" on public.rank_current;
create policy "rank_current public insert"
  on public.rank_current for insert to anon, authenticated with check (true);
drop policy if exists "rank_current public update" on public.rank_current;
create policy "rank_current public update"
  on public.rank_current for update to anon, authenticated using (true) with check (true);
drop policy if exists "rank_current public delete" on public.rank_current;
create policy "rank_current public delete"
  on public.rank_current for delete to anon, authenticated using (true);

-- rank_periods
drop policy if exists "rank_periods public select" on public.rank_periods;
create policy "rank_periods public select"
  on public.rank_periods for select to anon, authenticated using (true);
drop policy if exists "rank_periods public insert" on public.rank_periods;
create policy "rank_periods public insert"
  on public.rank_periods for insert to anon, authenticated with check (true);
drop policy if exists "rank_periods public update" on public.rank_periods;
create policy "rank_periods public update"
  on public.rank_periods for update to anon, authenticated using (true) with check (true);
drop policy if exists "rank_periods public delete" on public.rank_periods;
create policy "rank_periods public delete"
  on public.rank_periods for delete to anon, authenticated using (true);

-- rank_runs
drop policy if exists "rank_runs public select" on public.rank_runs;
create policy "rank_runs public select"
  on public.rank_runs for select to anon, authenticated using (true);
drop policy if exists "rank_runs public insert" on public.rank_runs;
create policy "rank_runs public insert"
  on public.rank_runs for insert to anon, authenticated with check (true);
drop policy if exists "rank_runs public update" on public.rank_runs;
create policy "rank_runs public update"
  on public.rank_runs for update to anon, authenticated using (true) with check (true);
drop policy if exists "rank_runs public delete" on public.rank_runs;
create policy "rank_runs public delete"
  on public.rank_runs for delete to anon, authenticated using (true);

-- ─── Grants ─────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.rank_games    to anon, authenticated;
grant select, insert, update, delete on public.rank_current  to anon, authenticated;
grant select, insert, update, delete on public.rank_periods  to anon, authenticated;
grant select, insert, update, delete on public.rank_runs     to anon, authenticated;

notify pgrst, 'reload schema';
