-- Keep application role assignments tied to a profile row.
-- Backfill any legacy role holders whose profile row is missing before
-- switching the FK, so existing valid role assignments do not block deploy.
insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(coalesce(u.email, ''), '@', 1)
  )
from auth.users u
join public.user_roles ur on ur.user_id = u.id
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Every auth user is expected to have a profile via handle_new_user.
-- Express that invariant in the FK and cascade role cleanup with profiles.
alter table public.user_roles
  drop constraint if exists user_roles_user_id_fkey;

alter table public.user_roles
  add constraint user_roles_user_id_profiles_fkey
  foreign key (user_id)
  references public.profiles(id)
  on delete cascade;
