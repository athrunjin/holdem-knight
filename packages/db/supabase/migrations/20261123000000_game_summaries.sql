-- The results of settled games, kept for reports (ADR 0049).
--
-- A summary is worked out by the host's app from a game and its ledger when the settlement is
-- confirmed, and again whenever the settled game changes. It holds nothing the books do not
-- already say, so it is no part of a backup and can be made again at any time.

create table public.game_summaries (
  organizer_id uuid not null,
  -- The game's ID: a game has one summary
  id text collate "C" not null check (id <> ''),
  data jsonb not null,
  -- The day the game started where it was played, which reports go by
  day text collate "C" generated always as (data ->> 'day') stored not null,
  currency text generated always as (data ->> 'currency') stored not null,
  primary key (organizer_id, id),
  foreign key (organizer_id, id) references public.games (organizer_id, id) on delete cascade,
  check (data ->> 'id' = id and data ->> 'organizerId' = organizer_id::text)
);

create index game_summaries_by_day on public.game_summaries (organizer_id, day);

alter table public.game_summaries enable row level security;

revoke all on public.game_summaries from anon, authenticated;

-- Only the owner so far. What a linked player reads of a game is a copy of their own row, made
-- when players are linked (ADR 0042), never this table.
grant select, insert, update, delete on public.game_summaries to authenticated;

create policy "owner keeps the game summaries" on public.game_summaries
for all to authenticated
using (public.has_role(organizer_id, array['owner']))
with check (public.has_role(organizer_id, array['owner']));
