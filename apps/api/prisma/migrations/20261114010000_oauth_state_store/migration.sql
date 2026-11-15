-- Persist OAuth attempts across API instances and make callback consumption atomic.
CREATE TABLE IF NOT EXISTS "library"."oauth_states" (
    "NonceHash" character varying(64) NOT NULL,
    "BrowserBindingHash" character varying(64) NOT NULL,
    "ExpiresAt" timestamp(3) with time zone NOT NULL,
    CONSTRAINT "PK_oauth_states" PRIMARY KEY ("NonceHash")
);
CREATE INDEX IF NOT EXISTS "IX_oauth_states_ExpiresAt"
    ON "library"."oauth_states" ("ExpiresAt");
