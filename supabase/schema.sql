-- Fantasy IPL Database Schema
-- Run this in Supabase SQL Editor

-- Players (IPL cricketers)
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('WK', 'BAT', 'AR', 'BOWL')),
  franchise text not null,
  is_overseas boolean not null default false,
  image_url text
);

-- Leagues
create table leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id) not null,
  draft_status text not null default 'pending' check (draft_status in ('pending', 'in_progress', 'completed')),
  draft_order uuid[] default '{}',
  current_pick int not null default 0,
  season_year int not null default extract(year from now()),
  created_at timestamptz not null default now()
);

-- League members
create table league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  team_name text not null,
  total_points numeric not null default 0,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

-- Draft picks
create table draft_picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  player_id uuid references players(id) not null,
  pick_number int not null,
  round int not null,
  picked_at timestamptz not null default now(),
  unique (league_id, pick_number),
  unique (league_id, player_id)
);

-- Rosters (current team composition)
create table rosters (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  player_id uuid references players(id) not null,
  is_captain boolean not null default false,
  is_vice_captain boolean not null default false,
  acquired_via text not null default 'draft' check (acquired_via in ('draft', 'transfer', 'waiver')),
  unique (league_id, user_id, player_id)
);

-- Matches
create table matches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade not null,
  matchweek int not null,
  team_home text not null,
  team_away text not null,
  match_date timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'completed'))
);

-- Player scores per match
create table player_scores (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade not null,
  player_id uuid references players(id) not null,
  runs int not null default 0,
  balls_faced int not null default 0,
  fours int not null default 0,
  sixes int not null default 0,
  overs_bowled numeric not null default 0,
  maidens int not null default 0,
  runs_conceded int not null default 0,
  wickets int not null default 0,
  catches int not null default 0,
  stumpings int not null default 0,
  run_outs int not null default 0,
  fantasy_points numeric not null default 0,
  entered_by uuid references auth.users(id),
  entered_at timestamptz not null default now(),
  unique (match_id, player_id)
);

-- Transfers
create table transfers (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references leagues(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  player_in_id uuid references players(id) not null,
  player_out_id uuid references players(id) not null,
  matchweek int not null,
  is_free boolean not null default true,
  point_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table draft_picks enable row level security;
alter table rosters enable row level security;
alter table matches enable row level security;
alter table player_scores enable row level security;
alter table transfers enable row level security;
alter table players enable row level security;

-- Players are readable by everyone
create policy "Players are viewable by authenticated users"
  on players for select to authenticated using (true);

-- Leagues: members can view, creator can update
create policy "League members can view leagues"
  on leagues for select to authenticated
  using (id in (select league_id from league_members where user_id = auth.uid()));

create policy "Anyone can create a league"
  on leagues for insert to authenticated
  with check (created_by = auth.uid());

create policy "League creator can update"
  on leagues for update to authenticated
  using (created_by = auth.uid());

-- League members
create policy "League members can view members"
  on league_members for select to authenticated
  using (league_id in (select league_id from league_members lm where lm.user_id = auth.uid()));

create policy "Users can join leagues"
  on league_members for insert to authenticated
  with check (user_id = auth.uid());

-- Draft picks: visible to league members
create policy "League members can view draft picks"
  on draft_picks for select to authenticated
  using (league_id in (select league_id from league_members where user_id = auth.uid()));

create policy "Users can make their own picks"
  on draft_picks for insert to authenticated
  with check (user_id = auth.uid());

-- Rosters
create policy "League members can view rosters"
  on rosters for select to authenticated
  using (league_id in (select league_id from league_members where user_id = auth.uid()));

create policy "Users can manage their roster"
  on rosters for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their roster"
  on rosters for update to authenticated
  using (user_id = auth.uid());

create policy "Users can delete from their roster"
  on rosters for delete to authenticated
  using (user_id = auth.uid());

-- Matches: visible to league members
create policy "League members can view matches"
  on matches for select to authenticated
  using (league_id in (select league_id from league_members where user_id = auth.uid()));

-- Player scores: visible to league members
create policy "League members can view scores"
  on player_scores for select to authenticated
  using (match_id in (
    select m.id from matches m
    join league_members lm on lm.league_id = m.league_id
    where lm.user_id = auth.uid()
  ));

create policy "Authenticated users can enter scores"
  on player_scores for insert to authenticated
  with check (entered_by = auth.uid());

create policy "Score enterer can update"
  on player_scores for update to authenticated
  using (entered_by = auth.uid());

-- Transfers
create policy "League members can view transfers"
  on transfers for select to authenticated
  using (league_id in (select league_id from league_members where user_id = auth.uid()));

create policy "Users can make their own transfers"
  on transfers for insert to authenticated
  with check (user_id = auth.uid());
