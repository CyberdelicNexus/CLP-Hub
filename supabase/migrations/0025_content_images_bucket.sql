-- =============================================================================
-- CLP Hub · Migration 0025 · Content images bucket (staff image uploads)
--
-- Until now every IMAGE block and cover banner stored only a pasted external
-- URL — no upload path existed anywhere in the app (2026-09-29 request). This
-- adds a public-read Supabase Storage bucket staff can upload into, scoped by
-- role and by study.
--
-- `storage.objects` RLS cannot import src/domain/permissions.ts (SQL, not
-- TypeScript), so it can't check `content.manage` the way the app does. The
-- narrow `content_images_can_manage` function below is the one deliberate
-- exception to D-006's "no permission matrix duplicated in SQL": it hardcodes
-- the two roles that hold `content.manage` today (ADMIN, STUDY_MANAGER) — if
-- that grant ever changes in permissions.ts, this must be updated by hand,
-- there is no other link between them. It runs SECURITY DEFINER specifically
-- so `storage.objects`' policies can check role membership without opening a
-- general SELECT grant on `user_roles` to the `authenticated` Postgres role
-- (which every anon-key-authenticated staff session runs as) — the function
-- only ever answers "does the CALLER (auth.uid(), never attacker-supplied)
-- hold this role for this study", it cannot be used to read anyone else's
-- role grants.
--
-- Object path convention the app's upload action writes to:
--   content-images/{studyId}/{uuid}.{ext}
-- `storage.foldername(name)` (a built-in Supabase Storage helper) splits that
-- into folder segments; `(storage.foldername(name))[1]` is the studyId.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('content-images', 'content-images', true)
on conflict (id) do nothing;

create or replace function content_images_can_manage(target_study_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.study_id = target_study_id
      and user_roles.revoked_at is null
      and user_roles.role in ('ADMIN', 'STUDY_MANAGER')
  );
$$;

revoke all on function content_images_can_manage(uuid) from public;
grant execute on function content_images_can_manage(uuid) to authenticated;

-- Read: public, same as the images these get embedded next to (public study
-- pages contain no participant data and require no sign-in, D-003).
create policy "content-images public read"
  on storage.objects for select
  using (bucket_id = 'content-images');

create policy "content-images staff upload"
  on storage.objects for insert
  with check (
    bucket_id = 'content-images'
    and content_images_can_manage(((storage.foldername(name))[1])::uuid)
  );

create policy "content-images staff update"
  on storage.objects for update
  using (
    bucket_id = 'content-images'
    and content_images_can_manage(((storage.foldername(name))[1])::uuid)
  );

create policy "content-images staff delete"
  on storage.objects for delete
  using (
    bucket_id = 'content-images'
    and content_images_can_manage(((storage.foldername(name))[1])::uuid)
  );
