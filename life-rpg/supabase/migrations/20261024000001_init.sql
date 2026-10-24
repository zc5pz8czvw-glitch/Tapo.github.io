-- LIFE RPG — schema backend (Supabase / PostgreSQL)
-- Principii:
--   • fiecare tabel are RLS activ; clientul (cheia publică „anon”) nu poate scrie direct în niciun tabel:
--     toate scrierile trec prin funcții RPC care validează datele și verifică auth.uid();
--   • datele unui jucător sunt vizibile doar lui; ceilalți văd doar „cartea de joc” (nume, avatar, nivel, XP…)
--     și doar dacă sunt prieteni sau dacă jucătorul a ales liga publică;
--   • ștergerea contului șterge tot (ON DELETE CASCADE pornind de la auth.users);
--   • funcțiile SECURITY DEFINER au search_path gol și nume complet calificate.

-- ============================================================================
-- 0. Utilitare
-- ============================================================================
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- săptămâna începe luni (la fel ca în aplicație)
create or replace function private.week_start(d date) returns date
language sql immutable set search_path = '' as $$
  select (d - ((extract(isodow from d)::int) - 1))::date
$$;

-- cod de prieten: 8 caractere fără 0/O/1/I/L, ușor de dictat
create or replace function private.new_friend_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.friend_code = code);
  end loop;
  return code;
end $$;

-- filtru pentru numele afișate altor jucători (cerința Apple 1.2: filtrarea conținutului ofensator).
-- Normalizăm (litere mici, fără diacritice/simboluri, cifre-„leet” → litere) și căutăm rădăcini interzise.
create or replace function private.name_is_clean(n text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  t text;
  bad text;
  blocked constant text[] := array[
    -- en
    'fuck','shit','bitch','cunt','nigg','faggot','whore','slut','rapist','hitler','pussy','porn','retard',
    -- ro
    'pula','pizd','muie','curva','futut','fute','cacat','labagiu','poponar','tigan',
    -- ru (chirilic și transliterat)
    'хуй','хуё','пизд','ебат','ебан','ебл','бляд','сука','пидор','шлюх','мудак','залуп','huy','pizd','ebat','blyad','pidor'
  ];
begin
  if n is null then return true; end if;
  t := lower(n);
  t := translate(t, 'ăâîșşțţáàäéèëíìïóòöúùüçñ', 'aaissttaaaeeeiiiooouuucn');
  t := translate(t, '013457@$', 'oieastas');
  t := regexp_replace(t, '[^a-zа-яё]', '', 'g');
  foreach bad in array blocked loop
    if position(bad in t) > 0 then return false; end if;
  end loop;
  -- fără adrese web / e-mail în nume
  if n ~* '(https?://|www\.|\.(com|ru|ro|net|org)\b|@)' then return false; end if;
  return true;
end $$;

create or replace function private.clean_text(s text, maxlen int) returns text
language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(coalesce(s, ''), '[[:cntrl:]]', '', 'g')), maxlen)
$$;

-- ============================================================================
-- 1. Profiluri
-- ============================================================================
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 24),
  avatar        text not null default '' check (avatar ~ '^[a-z0-9_-]{0,24}$'),
  lang          text not null default 'ro' check (lang in ('ro', 'en', 'ru')),
  friend_code   text not null unique check (friend_code ~ '^[A-Z0-9]{8}$'),
  league_opt_in boolean not null default false,
  ai_consent_at timestamptz,
  plan          text not null default 'free' check (plan in ('free', 'premium')),
  plan_until    timestamptz,
  disabled      boolean not null default false,   -- blocare administrativă (abuz)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profil: doar propriul" on public.profiles for select to authenticated using (id = (select auth.uid()));

-- profil creat automat la înregistrare
create or replace function private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, friend_code) values (new.id, private.new_friend_code())
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.on_auth_user_created();

create or replace function public.get_my_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'display_name', p.display_name, 'avatar', p.avatar, 'lang', p.lang, 'friend_code', p.friend_code,
    'league_opt_in', p.league_opt_in, 'ai_consent', p.ai_consent_at is not null,
    'plan', case when p.plan = 'premium' and (p.plan_until is null or p.plan_until > now()) then 'premium' else 'free' end,
    'disabled', p.disabled)
  from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.update_profile(p_display_name text default null, p_avatar text default null,
                                                 p_lang text default null, p_league_opt_in boolean default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  n text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if p_display_name is not null then
    n := private.clean_text(p_display_name, 24);
    if char_length(n) < 2 then return jsonb_build_object('ok', false, 'code', 'name_too_short'); end if;
    if not private.name_is_clean(n) then return jsonb_build_object('ok', false, 'code', 'name_rejected'); end if;
  end if;
  if p_avatar is not null and p_avatar !~ '^[a-z0-9_-]{1,24}$' then return jsonb_build_object('ok', false, 'code', 'invalid_avatar'); end if;
  if p_lang is not null and p_lang not in ('ro', 'en', 'ru') then return jsonb_build_object('ok', false, 'code', 'invalid_lang'); end if;
  update public.profiles set
    display_name  = coalesce(n, display_name),
    avatar        = coalesce(p_avatar, avatar),
    lang          = coalesce(p_lang, lang),
    league_opt_in = coalesce(p_league_opt_in, league_opt_in),
    updated_at    = now()
  where id = uid;
  return jsonb_build_object('ok', true, 'profile', public.get_my_profile());
end $$;

-- acordul explicit pentru trimiterea datelor către furnizorul AI (Apple 5.1.2(i))
create or replace function public.set_ai_consent(p_consent boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  update public.profiles set ai_consent_at = case when p_consent then now() else null end, updated_at = now() where id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================================
-- 2. Salvarea progresului (o copie per jucător, scriere atomică cu verificarea reviziei)
-- ============================================================================
create table public.saves (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  rev               text not null check (rev ~ '^[A-Za-z0-9_-]{4,64}$'),
  enc               text not null check (enc in ('gz', 'json')),
  data              text not null check (octet_length(data) <= 4000000),
  bytes             int not null check (bytes >= 0),
  checksum          text not null check (checksum ~ '^[0-9a-f]{8}$'),
  hash              text not null check (hash ~ '^[0-9a-f]{8}$'),
  schema_version    int not null,
  device_id         text check (char_length(device_id) <= 64),
  save_count        bigint,
  client_updated_at bigint,
  summary           jsonb not null default '{}'::jsonb check (octet_length(summary::text) <= 2000),
  pushed_at         timestamptz not null default now()
);
alter table public.saves enable row level security;
create policy "salvare: doar propria" on public.saves for select to authenticated using (user_id = (select auth.uid()));

-- metadatele copiei din cont (fără date), pentru verificarea de la pornire și pentru conflicte
create or replace function public.get_save_meta() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('rev', s.rev, 'hash', s.hash, 'checksum', s.checksum, 'enc', s.enc, 'bytes', s.bytes,
      'schema', s.schema_version, 'device_id', s.device_id, 'save_count', s.save_count, 'updated_at', s.client_updated_at,
      'pushed_at', floor(extract(epoch from s.pushed_at) * 1000)::bigint, 'summary', s.summary)
    from public.saves s where s.user_id = auth.uid()), 'null'::jsonb)
$$;

-- Scrie copia doar dacă revizia din cont este cea așteptată (p_expected_rev; null = nu există încă nicio copie).
-- Cu p_force = true suprascrie (după ce utilizatorul a ales explicit „păstrează ce e pe acest dispozitiv”).
create or replace function public.push_save(
  p_expected_rev text, p_rev text, p_enc text, p_data text, p_bytes int, p_checksum text, p_hash text,
  p_schema int, p_device_id text, p_save_count bigint, p_updated_at bigint, p_summary jsonb, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cur public.saves%rowtype;
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if exists (select 1 from public.profiles where id = uid and disabled) then return jsonb_build_object('ok', false, 'code', 'account_disabled'); end if;
  if octet_length(coalesce(p_data, '')) > 4000000 then return jsonb_build_object('ok', false, 'code', 'too_large'); end if;
  select * into cur from public.saves where user_id = uid for update;
  if found then
    if not coalesce(p_force, false) and cur.rev is distinct from p_expected_rev then
      if cur.hash = p_hash then
        return jsonb_build_object('ok', true, 'adopted', true, 'rev', cur.rev);
      end if;
      return jsonb_build_object('ok', false, 'code', 'conflict', 'remote', public.get_save_meta());
    end if;
    if cur.pushed_at > now() - interval '2 seconds' and not coalesce(p_force, false) then
      return jsonb_build_object('ok', false, 'code', 'rate_limited');
    end if;
    update public.saves set rev = p_rev, enc = p_enc, data = p_data, bytes = p_bytes, checksum = p_checksum, hash = p_hash,
      schema_version = p_schema, device_id = left(p_device_id, 64), save_count = p_save_count, client_updated_at = p_updated_at,
      summary = coalesce(p_summary, '{}'::jsonb), pushed_at = now()
    where user_id = uid;
  else
    if p_expected_rev is not null and not coalesce(p_force, false) then
      -- clientul crede că există o copie, dar a fost ștearsă (alt dispozitiv): îl lăsăm să decidă
      return jsonb_build_object('ok', false, 'code', 'conflict', 'remote', 'null'::jsonb);
    end if;
    insert into public.saves (user_id, rev, enc, data, bytes, checksum, hash, schema_version, device_id, save_count, client_updated_at, summary)
    values (uid, p_rev, p_enc, p_data, p_bytes, p_checksum, p_hash, p_schema, left(p_device_id, 64), p_save_count, p_updated_at, coalesce(p_summary, '{}'::jsonb));
  end if;
  return jsonb_build_object('ok', true, 'rev', p_rev);
end $$;

create or replace function public.delete_save() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  delete from public.saves where user_id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================================
-- 3. Cartea de joc, prieteni, blocări, ligă
-- ============================================================================
create table public.player_cards (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  level        int not null default 1 check (level between 1 and 9999),
  xp           bigint not null default 0 check (xp between 0 and 1000000000),
  week_xp      int not null default 0 check (week_xp between 0 and 10000000),
  week_start   date,
  streak       int not null default 0 check (streak between 0 and 100000),
  best_streak  int not null default 0 check (best_streak between 0 and 100000),
  quests       int not null default 0 check (quests between 0 and 10000000),
  achievements int not null default 0 check (achievements between 0 and 1000),
  updated_at   timestamptz not null default now()
);
alter table public.player_cards enable row level security;
create policy "carte: doar propria" on public.player_cards for select to authenticated using (user_id = (select auth.uid()));

create table public.friendships (
  user_id    uuid not null references auth.users (id) on delete cascade,
  friend_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index friendships_friend_idx on public.friendships (friend_id);
alter table public.friendships enable row level security;
create policy "prietenii: doar ale mele" on public.friendships for select to authenticated using (user_id = (select auth.uid()));

create table public.blocks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
create policy "blocări: doar ale mele" on public.blocks for select to authenticated using (user_id = (select auth.uid()));

-- Publică cartea de joc. Datele vin de pe dispozitiv (aplicația înregistrează activități declarate de jucător),
-- deci nu pot fi „dovedite”; limităm însă creșterile neplauzibile, ca un jucător să nu poată sări în fruntea ligii.
create or replace function public.publish_card(p_level int, p_xp bigint, p_week_xp int, p_week_start date, p_streak int,
                                               p_best_streak int, p_quests int, p_achievements int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cur public.player_cards%rowtype;
  days numeric;
  max_gain bigint;
  this_week date := private.week_start(current_date);
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if p_week_start is not null and (p_week_start > this_week + 7 or p_week_start < this_week - 14) then p_week_start := null; end if;
  select * into cur from public.player_cards where user_id = uid for update;
  if found then
    if cur.updated_at > now() - interval '3 seconds' then return jsonb_build_object('ok', false, 'code', 'rate_limited'); end if;
    days := least(30, greatest(1, extract(epoch from (now() - cur.updated_at)) / 86400.0));
    max_gain := ceil(days * 8000);                         -- plafon generos: ~8000 XP/zi
    p_xp := least(greatest(p_xp, 0), cur.xp + max_gain);
  else
    p_xp := least(greatest(p_xp, 0), 2000000);             -- prima publicare (progres adus de pe dispozitiv)
  end if;
  insert into public.player_cards as c (user_id, level, xp, week_xp, week_start, streak, best_streak, quests, achievements, updated_at)
  values (uid, least(greatest(coalesce(p_level, 1), 1), 9999), p_xp,
          least(greatest(coalesce(p_week_xp, 0), 0), 56000, p_xp::int), p_week_start,
          least(greatest(coalesce(p_streak, 0), 0), 100000), least(greatest(coalesce(p_best_streak, 0), 0), 100000),
          least(greatest(coalesce(p_quests, 0), 0), 10000000), least(greatest(coalesce(p_achievements, 0), 0), 1000), now())
  on conflict (user_id) do update set level = excluded.level, xp = excluded.xp, week_xp = excluded.week_xp, week_start = excluded.week_start,
    streak = excluded.streak, best_streak = greatest(excluded.best_streak, excluded.streak), quests = excluded.quests,
    achievements = excluded.achievements, updated_at = now();
  return jsonb_build_object('ok', true, 'xp', p_xp);
end $$;

create or replace function public.add_friend(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  fid uuid;
  code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if char_length(code) <> 8 then return jsonb_build_object('ok', false, 'code', 'invalid_code'); end if;
  -- limităm încercările (ghicirea codurilor): cel mult 30 de adăugări pe zi
  if (select count(*) from public.friendships where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;
  select id into fid from public.profiles where friend_code = code and not disabled;
  if fid is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if fid = uid then return jsonb_build_object('ok', false, 'code', 'self'); end if;
  if exists (select 1 from public.blocks where (user_id = uid and blocked_id = fid) or (user_id = fid and blocked_id = uid)) then
    return jsonb_build_object('ok', false, 'code', 'not_found');   -- nu dezvăluim că există o blocare
  end if;
  if exists (select 1 from public.friendships where user_id = uid and friend_id = fid) then return jsonb_build_object('ok', true, 'already', true); end if;
  if (select count(*) from public.friendships where user_id = uid) >= 100 then return jsonb_build_object('ok', false, 'code', 'too_many'); end if;
  insert into public.friendships (user_id, friend_id) values (uid, fid), (fid, uid) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.remove_friend(p_friend uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  delete from public.friendships where (user_id = auth.uid() and friend_id = p_friend) or (user_id = p_friend and friend_id = auth.uid());
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.block_user(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if p_user is null or p_user = auth.uid() or not exists (select 1 from public.profiles where id = p_user) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  insert into public.blocks (user_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  delete from public.friendships where (user_id = auth.uid() and friend_id = p_user) or (user_id = p_user and friend_id = auth.uid());
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.unblock_user(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  delete from public.blocks where user_id = auth.uid() and blocked_id = p_user;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.list_blocked() returns table (user_id uuid, display_name text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.blocked_id, p.display_name, b.created_at from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.user_id = auth.uid() order by b.created_at desc
$$;

-- clasamentul prietenilor (tu + prietenii tăi); doar câmpurile de joc, niciodată e-mailul
create or replace function public.friends_board() returns table (
  user_id uuid, display_name text, avatar text, level int, xp bigint, week_xp int, week_start date, streak int,
  best_streak int, quests int, achievements int, updated_at timestamptz, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with ids as (
    select auth.uid() as id
    union select f.friend_id from public.friendships f where f.user_id = auth.uid()
  )
  select p.id, p.display_name, p.avatar, coalesce(c.level, 1), coalesce(c.xp, 0), coalesce(c.week_xp, 0), c.week_start,
         coalesce(c.streak, 0), coalesce(c.best_streak, 0), coalesce(c.quests, 0), coalesce(c.achievements, 0),
         c.updated_at, p.id = auth.uid()
  from ids join public.profiles p on p.id = ids.id left join public.player_cards c on c.user_id = p.id
  where auth.uid() is not null and (p.id = auth.uid() or not p.disabled)
  order by coalesce(c.xp, 0) desc
  limit 101
$$;

-- liga săptămânală publică (doar jucătorii care au ales-o); fără cei blocați de tine sau care te-au blocat
create or replace function public.league_board(p_week date default null) returns table (
  user_id uuid, display_name text, avatar text, level int, week_xp int, streak int, is_me boolean, rank bigint)
language sql stable security definer set search_path = '' as $$
  with w as (select coalesce(p_week, private.week_start(current_date)) as ws),
  rows as (
    select p.id, p.display_name, p.avatar, c.level, c.week_xp, c.streak, p.id = auth.uid() as me,
           rank() over (order by c.week_xp desc, c.updated_at asc) as rk
    from public.player_cards c join public.profiles p on p.id = c.user_id, w
    where p.league_opt_in and not p.disabled and c.week_start = w.ws and c.week_xp > 0 and p.display_name <> ''
      and not exists (select 1 from public.blocks b where (b.user_id = auth.uid() and b.blocked_id = p.id) or (b.user_id = p.id and b.blocked_id = auth.uid()))
  )
  select id, display_name, avatar, level, week_xp, streak, me, rk from rows
  where auth.uid() is not null and (rk <= 50 or me)
  order by rk
$$;

-- ============================================================================
-- 4. Raportări (conținut ofensator: nume sau răspunsuri ale Mentorului AI)
-- ============================================================================
create table public.reports (
  id          bigint generated always as identity primary key,
  reporter    uuid references auth.users (id) on delete set null,
  target_user uuid references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('name', 'ai_message', 'other')),
  details     text not null default '' check (char_length(details) <= 4000),
  status      text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at  timestamptz not null default now()
);
create index reports_open_idx on public.reports (status, created_at) where status = 'open';
alter table public.reports enable row level security;   -- fără politici: clientul nu citește raportările

create or replace function public.report_content(p_kind text, p_target uuid default null, p_details text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if p_kind not in ('name', 'ai_message', 'other') then return jsonb_build_object('ok', false, 'code', 'invalid'); end if;
  if (select count(*) from public.reports where reporter = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;
  insert into public.reports (reporter, target_user, kind, details)
  values (auth.uid(), case when p_target = auth.uid() then null else p_target end, p_kind, private.clean_text(p_details, 4000));
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================================
-- 5. Mentorul AI: cote (per utilizator / per minut / buget global zilnic) — doar pentru funcția server
-- ============================================================================
create table private.ai_usage (
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  count        int not null default 0,
  tokens_in    bigint not null default 0,
  tokens_out   bigint not null default 0,
  minute_start timestamptz not null default now(),
  minute_count int not null default 0,
  in_flight    int not null default 0,
  in_flight_at timestamptz,
  primary key (user_id, day)
);
create table private.ai_budget (
  day        date primary key,
  count      int not null default 0,
  tokens_in  bigint not null default 0,
  tokens_out bigint not null default 0,
  errors     int not null default 0
);

-- Rezervă o cerere AI. Returnează {ok:true,left} sau {ok:false,code}. Atomic (blocare pe rând).
create or replace function public.ai_take(p_user uuid, p_daily int, p_per_minute int, p_global_daily int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d date := (now() at time zone 'utc')::date;
  u private.ai_usage%rowtype;
  g int;
begin
  insert into private.ai_budget (day) values (d) on conflict do nothing;
  select count into g from private.ai_budget where day = d for update;
  if g >= p_global_daily then return jsonb_build_object('ok', false, 'code', 'global_budget'); end if;
  insert into private.ai_usage (user_id, day) values (p_user, d) on conflict do nothing;
  select * into u from private.ai_usage where user_id = p_user and day = d for update;
  if u.count >= p_daily then return jsonb_build_object('ok', false, 'code', 'quota_exceeded', 'limit', p_daily); end if;
  -- o singură cerere în curs per utilizator (o cerere „agățată” expiră după 90 s)
  if u.in_flight > 0 and u.in_flight_at > now() - interval '90 seconds' then return jsonb_build_object('ok', false, 'code', 'busy'); end if;
  if u.minute_start > now() - interval '1 minute' then
    if u.minute_count >= p_per_minute then return jsonb_build_object('ok', false, 'code', 'rate_limited'); end if;
    update private.ai_usage set minute_count = minute_count + 1 where user_id = p_user and day = d;
  else
    update private.ai_usage set minute_start = now(), minute_count = 1 where user_id = p_user and day = d;
  end if;
  update private.ai_usage set count = count + 1, in_flight = 1, in_flight_at = now() where user_id = p_user and day = d;
  update private.ai_budget set count = count + 1 where day = d;
  return jsonb_build_object('ok', true, 'left', p_daily - u.count - 1, 'limit', p_daily);
end $$;

-- Încheie o cerere: înregistrează consumul sau, dacă a eșuat la furnizor, returnează cota (nu pedepsim utilizatorul).
create or replace function public.ai_finish(p_user uuid, p_ok boolean, p_tokens_in int, p_tokens_out int) returns void
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'utc')::date;
begin
  if p_ok then
    update private.ai_usage set in_flight = 0, tokens_in = tokens_in + greatest(p_tokens_in, 0), tokens_out = tokens_out + greatest(p_tokens_out, 0)
      where user_id = p_user and day = d;
    update private.ai_budget set tokens_in = tokens_in + greatest(p_tokens_in, 0), tokens_out = tokens_out + greatest(p_tokens_out, 0) where day = d;
  else
    update private.ai_usage set in_flight = 0, count = greatest(count - 1, 0) where user_id = p_user and day = d;
    update private.ai_budget set count = greatest(count - 1, 0), errors = errors + 1 where day = d;
  end if;
end $$;

create or replace function public.ai_usage_of(p_user uuid, p_day date) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select u.count from private.ai_usage u where u.user_id = p_user and u.day = p_day), 0)
$$;

create or replace function public.ai_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('used', coalesce((select u.count from private.ai_usage u where u.user_id = auth.uid() and u.day = (now() at time zone 'utc')::date), 0))
$$;

-- ============================================================================
-- 6. Erori raportate de aplicație (pentru diagnoză; păstrate 30 de zile)
-- ============================================================================
create table public.client_errors (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete cascade,
  app_version text check (char_length(app_version) <= 32),
  platform    text check (char_length(platform) <= 32),
  message     text not null check (char_length(message) <= 500),
  detail      text check (char_length(detail) <= 4000),
  created_at  timestamptz not null default now()
);
create index client_errors_created_idx on public.client_errors (created_at);
alter table public.client_errors enable row level security;

create or replace function public.log_client_error(p_message text, p_detail text default null, p_app_version text default null, p_platform text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  if (select count(*) from public.client_errors where user_id = auth.uid() and created_at > now() - interval '1 day') >= 50 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;
  insert into public.client_errors (user_id, app_version, platform, message, detail)
  values (auth.uid(), left(p_app_version, 32), left(p_platform, 32), private.clean_text(p_message, 500), left(p_detail, 4000));
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================================
-- 7. Ștergerea contului (Apple 5.1.1(v)): șterge utilizatorul; toate datele lui dispar în cascadă
-- ============================================================================
create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'not_authenticated'); end if;
  delete from auth.users where id = uid;
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================================
-- 8. Curățenie periodică (pg_cron, dacă există): erori > 30 zile, cote AI > 60 zile, raportări închise > 180 zile
-- ============================================================================
create or replace function private.cleanup() returns void
language sql security definer set search_path = '' as $$
  delete from public.client_errors where created_at < now() - interval '30 days';
  delete from private.ai_usage where day < (now() at time zone 'utc')::date - 60;
  delete from public.reports where status <> 'open' and created_at < now() - interval '180 days';
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('liferpg-cleanup', '17 3 * * *', 'select private.cleanup()');
  end if;
exception when others then
  raise notice 'pg_cron indisponibil: rulează manual „select private.cleanup()” sau activează extensia (%).', sqlerrm;
end $$;

-- ============================================================================
-- 9. Drepturi: clientul nu atinge tabelele direct; doar funcțiile de mai jos sunt apelabile
-- ============================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant select on public.profiles, public.saves, public.player_cards, public.friendships, public.blocks to authenticated;

grant execute on function
  public.get_my_profile(), public.update_profile(text, text, text, boolean), public.set_ai_consent(boolean),
  public.get_save_meta(), public.push_save(text, text, text, text, int, text, text, int, text, bigint, bigint, jsonb, boolean),
  public.delete_save(), public.publish_card(int, bigint, int, date, int, int, int, int),
  public.add_friend(text), public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid), public.list_blocked(),
  public.friends_board(), public.league_board(date), public.report_content(text, uuid, text), public.ai_status(),
  public.log_client_error(text, text, text, text), public.delete_my_account()
to authenticated;

-- doar funcția server (cheia service_role) gestionează cotele AI
grant execute on function public.ai_take(uuid, int, int, int), public.ai_finish(uuid, boolean, int, int), public.ai_usage_of(uuid, date) to service_role;

-- funcțiile noi create în viitor nu devin automat publice
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
