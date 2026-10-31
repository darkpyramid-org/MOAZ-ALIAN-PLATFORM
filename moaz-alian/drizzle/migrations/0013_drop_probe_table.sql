-- Remove the temporary probe table introduced by 0011_probe_target.sql.
-- Keep historical migrations immutable; cleanup is forward-only.
drop table if exists public.lov_probe_8f3;
