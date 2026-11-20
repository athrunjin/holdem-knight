-- Accounts, host spaces and the books of a space (ADR 0040, ADR 0044).
--
-- An account is a profile over auth.users. A host space is an organizer: every record of its
-- books carries its ID. The app's records are kept as the documents the app validates, with the
-- columns the database itself needs worked out from them.

------------------------------------------------------------------------------------------------
-- Accounts
------------------------------------------------------------------------------------------------

/** A short code for people to read out and check: 8 characters from an ID made at random. */
create function public.new_code() returns text
language sql volatile
set search_path = ''
as $$ select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) $$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Need not be unique: an account is known by its ID, and shown with its code
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  code text not null unique default public.new_code(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

------------------------------------------------------------------------------------------------
-- Host spaces
------------------------------------------------------------------------------------------------

create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  -- For a player to ask to join by (ADR 0042)
  join_code text not null unique default public.new_code(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set when the owner deletes their account: the space goes 30 days later
  deleted_at timestamptz
);

-- One space for each account, for now. Dropping this index is all that more spaces need.
create unique index organizers_one_per_owner on public.organizers (owner_id);

create table public.organizer_members (
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'assistant')),
  created_at timestamptz not null default now(),
  primary key (organizer_id, user_id)
);

create index organizer_members_by_user on public.organizer_members (user_id);

/**
 * Whether the signed-in account has one of these roles in a space. It reads the members with the
 * rights of its owner, so the policies that call it do not have to be able to.
 */
create function public.has_role(space uuid, roles text[]) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organizer_members m
    where m.organizer_id = space and m.user_id = (select auth.uid()) and m.role = any (roles)
  )
$$;

/** A new account gets its profile, its space and its place in it as owner, all or none. */
create function public.handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  shown text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '玩家'
  );
  space uuid;
begin
  shown := left(shown, 30);
  insert into public.profiles (id, display_name) values (new.id, shown);
  insert into public.organizers (owner_id, name) values (new.id, shown) returning id into space;
  insert into public.organizer_members (organizer_id, user_id, role) values (space, new.id, 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

------------------------------------------------------------------------------------------------
-- The books of a space
------------------------------------------------------------------------------------------------

-- Each record is the document the app keeps (`data`), under its space and its own ID. IDs are
-- made by the app and are unique only within a space, so the space is part of every key.

create table public.games (
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  id text not null check (id <> ''),
  data jsonb not null,
  created_at bigint generated always as ((data ->> 'createdAt')::bigint) stored not null,
  status text generated always as (data ->> 'status') stored not null,
  primary key (organizer_id, id),
  check (data ->> 'id' = id and data ->> 'organizerId' = organizer_id::text)
);

create index games_newest_first on public.games (organizer_id, created_at desc);

create table public.players (
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  id text not null check (id <> ''),
  data jsonb not null,
  name text generated always as (data ->> 'name') stored not null,
  -- The account this record is linked to, once it is taken up (ADR 0042)
  linked_user_id uuid references public.profiles (id) on delete set null,
  primary key (organizer_id, id),
  -- An account is linked to at most one record in a space
  unique (organizer_id, linked_user_id),
  check (data ->> 'id' = id and data ->> 'organizerId' = organizer_id::text)
);

create index players_by_name on public.players (organizer_id, name);
create index players_by_account on public.players (linked_user_id) where linked_user_id is not null;

create table public.ledger_events (
  organizer_id uuid not null,
  id text not null check (id <> ''),
  data jsonb not null,
  game_id text generated always as (data ->> 'gameId') stored not null,
  occurred_at bigint generated always as ((data ->> 'occurredAt')::bigint) stored not null,
  type text generated always as (data ->> 'type') stored not null,
  -- Missing on a reversal, which points to the event it undoes
  player_id text generated always as (data ->> 'playerId') stored,
  primary key (organizer_id, id),
  foreign key (organizer_id, game_id) references public.games (organizer_id, id) on delete cascade,
  check (data ->> 'id' = id and data ->> 'organizerId' = organizer_id::text)
);

create index ledger_events_by_game on public.ledger_events (organizer_id, game_id, occurred_at);

create table public.insurance_hands (
  organizer_id uuid not null,
  id text not null check (id <> ''),
  data jsonb not null,
  game_id text generated always as (data ->> 'gameId') stored not null,
  created_at bigint generated always as ((data ->> 'createdAt')::bigint) stored not null,
  primary key (organizer_id, id),
  foreign key (organizer_id, game_id) references public.games (organizer_id, id) on delete cascade,
  check (data ->> 'id' = id and data ->> 'organizerId' = organizer_id::text)
);

create index insurance_hands_by_game on public.insurance_hands (organizer_id, game_id, created_at);

-- Everything saved under a name, in one table: insurance settings, odds tables, the settings of
-- the basics, wages, the table fee and rake, and whole game configs.
create table public.saved_configs (
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  id text not null check (id <> ''),
  -- Which of the app's lists it belongs to
  collection text not null
    check (collection in ('insuranceRules', 'oddsTables', 'chargeRules', 'gameConfigs')),
  data jsonb not null,
  created_at bigint generated always as ((data ->> 'createdAt')::bigint) stored not null,
  primary key (organizer_id, id),
  check (data ->> 'id' = id and data ->> 'organizerId' = organizer_id::text)
);

create index saved_configs_oldest_first
  on public.saved_configs (organizer_id, collection, created_at);

------------------------------------------------------------------------------------------------
-- Who may do what (ADR 0042). Only the owner so far: assistants and linked players come later.
------------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizers enable row level security;
alter table public.organizer_members enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.ledger_events enable row level security;
alter table public.insurance_hands enable row level security;
alter table public.saved_configs enable row level security;

-- Nothing is open to a visitor who has not signed in, and a signed-in account gets exactly what
-- is granted below, whatever a project grants by default.
revoke all on
  public.profiles, public.organizers, public.organizer_members, public.games, public.players,
  public.ledger_events, public.insurance_hands, public.saved_configs
from anon, authenticated;

-- An account reads its own profile and changes only the name it shows
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "read own profile" on public.profiles
for select to authenticated using (id = (select auth.uid()));

create policy "rename own profile" on public.profiles
for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- A space is read by its members and renamed by its owner. Sign-up makes it; nothing else does.
grant select on public.organizers to authenticated;
grant update (name) on public.organizers to authenticated;

create policy "members read their space" on public.organizers
for select to authenticated using (public.has_role(id, array['owner', 'assistant']));

create policy "owner renames the space" on public.organizers
for update to authenticated
using (public.has_role(id, array['owner'])) with check (public.has_role(id, array['owner']));

grant select on public.organizer_members to authenticated;

create policy "read own memberships" on public.organizer_members
for select to authenticated using (user_id = (select auth.uid()));

-- The owner keeps the books
grant select, insert, update, delete on
  public.games, public.insurance_hands, public.saved_configs
to authenticated;

-- Of a player record the owner writes the document only. The account it is linked to is set by
-- a function when a record is taken up (ADR 0042), never by hand.
grant select, delete on public.players to authenticated;
grant insert (organizer_id, id, data) on public.players to authenticated;
grant update (data) on public.players to authenticated;

create policy "owner keeps the games" on public.games
for all to authenticated
using (public.has_role(organizer_id, array['owner']))
with check (public.has_role(organizer_id, array['owner']));

create policy "owner keeps the players" on public.players
for all to authenticated
using (public.has_role(organizer_id, array['owner']))
with check (public.has_role(organizer_id, array['owner']));

create policy "owner keeps the insurance hands" on public.insurance_hands
for all to authenticated
using (public.has_role(organizer_id, array['owner']))
with check (public.has_role(organizer_id, array['owner']));

create policy "owner keeps the saved configs" on public.saved_configs
for all to authenticated
using (public.has_role(organizer_id, array['owner']))
with check (public.has_role(organizer_id, array['owner']));

-- The ledger is append-only (ADR 0005): it can be read and added to, and there is no right at
-- all to change or delete an event, for anyone who signs in.
grant select, insert on public.ledger_events to authenticated;

create policy "owner reads the ledger" on public.ledger_events
for select to authenticated using (public.has_role(organizer_id, array['owner']));

create policy "owner adds to the ledger" on public.ledger_events
for insert to authenticated with check (public.has_role(organizer_id, array['owner']));

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(uuid, text[]) to authenticated;
