create policy "media public read" on storage.objects for select to anon, authenticated using (bucket_id = 'media');
create policy "media staff upload" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_staff(auth.uid()));
create policy "media staff update" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_staff(auth.uid())) with check (bucket_id = 'media' and public.is_staff(auth.uid()));
create policy "media staff delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_staff(auth.uid()));
create policy "media service access" on storage.objects for all to service_role using (bucket_id = 'media') with check (bucket_id = 'media');