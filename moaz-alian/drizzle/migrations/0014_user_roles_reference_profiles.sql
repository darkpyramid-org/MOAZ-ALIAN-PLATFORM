-- Keep application role assignments tied to a profile row.
-- Every auth user should have a profile via handle_new_user; the FK now
-- expresses that invariant and cascades cleanup through profiles.
alter table public.user_roles
  drop constraint if exists user_roles_user_id_fkey;

alter table public.user_roles
  add constraint user_roles_user_id_profiles_fkey
  foreign key (user_id)
  references public.profiles(id)
  on delete cascade;
