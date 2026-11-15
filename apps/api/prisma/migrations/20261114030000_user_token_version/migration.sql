-- Monotonic session version. Existing tokens without a version are treated
-- as version 0 until a password/role mutation revokes them.
ALTER TABLE "library"."users"
  ADD COLUMN IF NOT EXISTS "TokenVersion" integer NOT NULL DEFAULT 0;
