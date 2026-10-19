-- Let admins upload lyric files (.lrc) from the LRC layer (lrc.th3scr1b3.art) to the
-- `releaseready` storage bucket, under lyrics/<month>/<dd> - <title>.lrc.
--
-- Release media moved to R2 (files.th3scr1b3.art), so this project may not have the bucket,
-- and storage.objects had no policy letting a signed-in user write to it. Both made LRC's
-- "Publish" fail on the file upload even though the karaoke timings (public.lyric_timings)
-- saved. The bucket is created only if missing; an existing bucket keeps its settings.
--
-- Writes are limited to admins (public.is_admin()) and to the lyrics/ folder. Upserts need
-- select + insert + update, so all three are granted.

begin;

insert into storage.buckets (id, name, public)
values ('releaseready', 'releaseready', true)
on conflict (id) do nothing;

drop policy if exists "releaseready_lyrics_admin_select" on storage.objects;
drop policy if exists "releaseready_lyrics_admin_insert" on storage.objects;
drop policy if exists "releaseready_lyrics_admin_update" on storage.objects;
drop policy if exists "releaseready_lyrics_admin_delete" on storage.objects;

create policy "releaseready_lyrics_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'releaseready' and name like 'lyrics/%' and public.is_admin());

create policy "releaseready_lyrics_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'releaseready' and name like 'lyrics/%' and public.is_admin());

create policy "releaseready_lyrics_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'releaseready' and name like 'lyrics/%' and public.is_admin())
  with check (bucket_id = 'releaseready' and name like 'lyrics/%' and public.is_admin());

create policy "releaseready_lyrics_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'releaseready' and name like 'lyrics/%' and public.is_admin());

commit;
