-- The host's own record (ADR 0051).
--
-- Every space has one player record that is its owner: the organizer seat of its games
-- (ADR 0028), under the seat's fixed ID, `organizer`. The app makes it when it first reads the
-- player list of a space that has none, so it is made the same way on a device and in an account,
-- and a guest's record brought in is the same record. The primary key keeps it to one a space.
--
-- Here the database holds the rest: the record is linked to the space's owner, whatever the app
-- sends, and stays so; it cannot be deleted, or moved to another ID or space, by the app.

/**
 * Links the own record to the owner of its space on every write, and keeps it where it is. Other
 * records pass as they are: their link is set by a function when a record is linked (ADR 0042).
 */
create function public.keep_own_record() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.id = 'organizer'
    and (new.id, new.organizer_id) is distinct from (old.id, old.organizer_id) then
    raise exception 'The host''s own record stays under its ID and space'
      using errcode = 'check_violation';
  end if;
  if new.id = 'organizer' then
    new.linked_user_id := (
      select owner_id from public.organizers where id = new.organizer_id
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.keep_own_record() from public, anon, authenticated;

create trigger keep_own_record
before insert or update on public.players
for each row execute function public.keep_own_record();

-- The owner keeps the players as before, but deletes any record except its own. A policy and not
-- a trigger, so the record still goes with its space when the space is deleted.
drop policy "owner keeps the players" on public.players;

create policy "owner reads the players" on public.players
for select to authenticated
using (public.has_role(organizer_id, array['owner']));

create policy "owner adds players" on public.players
for insert to authenticated
with check (public.has_role(organizer_id, array['owner']));

create policy "owner changes players" on public.players
for update to authenticated
using (public.has_role(organizer_id, array['owner']))
with check (public.has_role(organizer_id, array['owner']));

create policy "owner deletes players but its own" on public.players
for delete to authenticated
using (public.has_role(organizer_id, array['owner']) and id <> 'organizer');
