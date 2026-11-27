-- Signing in with Google, and agreeing to the terms on first entry (ADR 0052).
--
-- An account made through Google, or by hand in the dashboard, has not said it is 18 or agreed to
-- the terms: the app asks it to before its books are used, and records the answer here. A new
-- account's name is taken from what Google gives where it gave no name of its own.

/**
 * A new account gets its profile, its space and its place in it as owner, all or none. It shows
 * the first name it was given that an account may show: its own (`display_name`, from the app's
 * sign-up), then Google's (`full_name`, then `name`); otherwise what its address starts with, as
 * far as that makes one; otherwise 玩家. A name that is refused never stops a sign-up. The terms
 * are agreed only where the app's sign-up says which text was agreed to.
 */
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  address text := left(
    regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^A-Za-z0-9_.-]', '', 'g'), 30
  );
  shown text;
  version text := nullif(left(btrim(meta ->> 'terms_version'), 20), '');
  space uuid;
begin
  shown := case
    when public.valid_display_name(meta ->> 'display_name') then meta ->> 'display_name'
    when public.valid_display_name(meta ->> 'full_name') then meta ->> 'full_name'
    when public.valid_display_name(meta ->> 'name') then meta ->> 'name'
    when public.valid_display_name(address) then address
    else '玩家'
  end;
  insert into public.profiles (id, display_name, agreed_at, agreed_version)
  values (new.id, shown, case when version is not null then now() end, version);
  insert into public.organizers (owner_id, name) values (new.id, shown) returning id into space;
  insert into public.organizer_members (organizer_id, user_id, role) values (space, new.id, 'owner');
  return new;
end;
$$;

/**
 * The signed-in account says it is 18 and agrees to the terms, under the name it confirms. The
 * name goes on its profile and on the space it owns, as a sign-up names both. The time is the
 * database's own and the version the one given, both kept from the first call only: a later one
 * changes the name and nothing else. A name an account may not show, or a version that is not 1
 * to 20 characters, is refused and nothing changes.
 */
create function public.agree_to_terms(display_name text, version text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Only a signed-in account agrees to the terms'
      using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(public.valid_display_name(agree_to_terms.display_name), false) then
    raise exception 'A name an account may not show' using errcode = 'check_violation';
  end if;
  if agree_to_terms.version is null or char_length(agree_to_terms.version) not between 1 and 20 then
    raise exception 'The version of the terms is 1 to 20 characters'
      using errcode = 'check_violation';
  end if;

  update public.profiles p
  set display_name = agree_to_terms.display_name,
      agreed_version = case when p.agreed_at is null then agree_to_terms.version
        else p.agreed_version end,
      agreed_at = coalesce(p.agreed_at, now()),
      updated_at = now()
  where p.id = me;

  update public.organizers o
  set name = agree_to_terms.display_name, updated_at = now()
  where o.owner_id = me;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.agree_to_terms(text, text) from public, anon;
grant execute on function public.agree_to_terms(text, text) to authenticated;
