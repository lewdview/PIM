-- Word-level lyric timings for the 365 releases, published from the LRC layer
-- (lrc.th3scr1b3.art) and read by the main site's karaoke view (Poetry Stream).
--
-- One row per release day. `words` and `segments` use the same shape the main site already
-- reads from release-data.json (seconds):
--   words:    [{ "word": "Neon", "start": 4.2, "end": 4.58 }, …]
--   segments: [{ "text": "Neon on the wet street", "start": 4.2, "end": 6.1 }, …]
-- `lyrics` is the plain text with no timestamps, so pages that print lyrics stay clean.
--
-- Anyone can read; only admins (public.is_admin()) can write, as themselves.

begin;

create table if not exists public.lyric_timings (
  day           integer primary key check (day between 1 and 366),
  storage_title text,
  title         text,
  lyrics        text not null default '',
  words         jsonb not null default '[]'::jsonb check (jsonb_typeof(words) = 'array'),
  segments      jsonb not null default '[]'::jsonb check (jsonb_typeof(segments) = 'array'),
  updated_by    uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at    timestamptz not null default now()
);

alter table public.lyric_timings enable row level security;

drop policy if exists "lyric_timings_read"         on public.lyric_timings;
drop policy if exists "lyric_timings_admin_insert" on public.lyric_timings;
drop policy if exists "lyric_timings_admin_update" on public.lyric_timings;
drop policy if exists "lyric_timings_admin_delete" on public.lyric_timings;

create policy "lyric_timings_read" on public.lyric_timings
  for select using (true);
create policy "lyric_timings_admin_insert" on public.lyric_timings
  for insert to authenticated with check (public.is_admin());
create policy "lyric_timings_admin_update" on public.lyric_timings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lyric_timings_admin_delete" on public.lyric_timings
  for delete to authenticated using (public.is_admin());

grant select on public.lyric_timings to anon, authenticated;
grant insert, update, delete on public.lyric_timings to authenticated;

-- Stamp who changed a row and when, whatever the client sends.
create or replace function public.lyric_timings_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists lyric_timings_stamp on public.lyric_timings;
create trigger lyric_timings_stamp
  before insert or update on public.lyric_timings
  for each row execute function public.lyric_timings_stamp();

commit;
