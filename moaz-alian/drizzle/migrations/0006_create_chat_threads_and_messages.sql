create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'محادثة جديدة',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.chat_threads to authenticated;
grant all on public.chat_threads to service_role;
alter table public.chat_threads enable row level security;
create policy "owner read threads" on public.chat_threads for select to authenticated using (user_id = auth.uid());
create policy "owner insert threads" on public.chat_threads for insert to authenticated with check (user_id = auth.uid());
create policy "owner update threads" on public.chat_threads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner delete threads" on public.chat_threads for delete to authenticated using (user_id = auth.uid());

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx on public.chat_messages (thread_id, created_at);
grant select, insert, delete on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "owner read messages" on public.chat_messages for select to authenticated using (exists (select 1 from public.chat_threads t where t.id = chat_messages.thread_id and t.user_id = auth.uid()));
create policy "owner insert messages" on public.chat_messages for insert to authenticated with check (exists (select 1 from public.chat_threads t where t.id = chat_messages.thread_id and t.user_id = auth.uid()));
create policy "owner delete messages" on public.chat_messages for delete to authenticated using (exists (select 1 from public.chat_threads t where t.id = chat_messages.thread_id and t.user_id = auth.uid()));

create trigger chat_threads_touch before update on public.chat_threads for each row execute function public.touch_updated_at();