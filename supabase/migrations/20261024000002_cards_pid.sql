-- Identificatorul de jucător din aplicație (pid) pe cartea de joc: permite clasamentului să unească
-- același prieten adăugat și prin codul offline (LRPG1…), și prin cont. Plus ștergerea cărții la cerere.

alter table public.player_cards add column if not exists pid text check (pid ~ '^[A-Za-z0-9_-]{4,40}$');

drop function if exists public.publish_card(int, bigint, int, date, int, int, int, int);
create or replace function public.publish_card(p_level int, p_xp bigint, p_week_xp int, p_week_start date, p_streak int,
                                               p_best_streak int, p_quests int, p_achievements int, p_pid text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cur public.player_cards%rowtype;
  days numeric;
  max_gain bigint;
  this_week date := private.week_start(current_date);
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if p_pid is not null and p_pid !~ '^[A-Za-z0-9_-]{4,40}$' then p_pid := null; end if;
  if p_week_start is not null and (p_week_start > this_week + 7 or p_week_start < this_week - 14) then p_week_start := null; end if;
  select * into cur from public.player_cards where user_id = uid for update;
  if found then
    if cur.updated_at > now() - interval '3 seconds' then return jsonb_build_object('ok', false, 'code', 'rate_limited'); end if;
    days := least(30, greatest(1, extract(epoch from (now() - cur.updated_at)) / 86400.0));
    max_gain := ceil(days * 8000);
    p_xp := least(greatest(p_xp, 0), cur.xp + max_gain);
  else
    p_xp := least(greatest(p_xp, 0), 2000000);
  end if;
  insert into public.player_cards as c (user_id, level, xp, week_xp, week_start, streak, best_streak, quests, achievements, pid, updated_at)
  values (uid, least(greatest(coalesce(p_level, 1), 1), 9999), p_xp,
          least(greatest(coalesce(p_week_xp, 0), 0), 56000, p_xp::int), p_week_start,
          least(greatest(coalesce(p_streak, 0), 0), 100000), least(greatest(coalesce(p_best_streak, 0), 0), 100000),
          least(greatest(coalesce(p_quests, 0), 0), 10000000), least(greatest(coalesce(p_achievements, 0), 0), 1000), p_pid, now())
  on conflict (user_id) do update set level = excluded.level, xp = excluded.xp, week_xp = excluded.week_xp, week_start = excluded.week_start,
    streak = excluded.streak, best_streak = greatest(excluded.best_streak, excluded.streak), quests = excluded.quests,
    achievements = excluded.achievements, pid = coalesce(excluded.pid, c.pid), updated_at = now();
  return jsonb_build_object('ok', true, 'xp', p_xp);
end $$;

create or replace function public.delete_card() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  delete from public.player_cards where user_id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

drop function if exists public.friends_board();
create or replace function public.friends_board() returns table (
  user_id uuid, display_name text, avatar text, level int, xp bigint, week_xp int, week_start date, streak int,
  best_streak int, quests int, achievements int, updated_at timestamptz, is_me boolean, pid text, has_card boolean)
language sql stable security definer set search_path = '' as $$
  with ids as (
    select auth.uid() as id
    union select f.friend_id from public.friendships f where f.user_id = auth.uid()
  )
  select p.id, p.display_name, p.avatar, coalesce(c.level, 1), coalesce(c.xp, 0), coalesce(c.week_xp, 0), c.week_start,
         coalesce(c.streak, 0), coalesce(c.best_streak, 0), coalesce(c.quests, 0), coalesce(c.achievements, 0),
         c.updated_at, p.id = auth.uid(), c.pid, c.user_id is not null
  from ids join public.profiles p on p.id = ids.id left join public.player_cards c on c.user_id = p.id
  where auth.uid() is not null and (p.id = auth.uid() or not p.disabled)
  order by coalesce(c.xp, 0) desc
  limit 101
$$;

revoke all on function public.publish_card(int, bigint, int, date, int, int, int, int, text), public.delete_card(), public.friends_board() from public, anon;
grant execute on function public.publish_card(int, bigint, int, date, int, int, int, int, text), public.delete_card(), public.friends_board() to authenticated;
