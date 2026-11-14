-- Stable provider-subject identity links. Email remains metadata and is
-- never used as the provider identity key.
CREATE TABLE IF NOT EXISTS "library"."oauth_identities" (
    "id" uuid NOT NULL,
    "provider" character varying(32) NOT NULL,
    "ProviderSubject" character varying(255) NOT NULL,
    "UserId" uuid NOT NULL,
    "EmailAtLink" character varying(255),
    "EmailVerified" boolean NOT NULL,
    "CreatedAt" timestamp(3) with time zone NOT NULL,
    CONSTRAINT "PK_oauth_identities" PRIMARY KEY ("id"),
    CONSTRAINT "FK_oauth_identities_users_UserId"
      FOREIGN KEY ("UserId") REFERENCES "library"."users" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_oauth_identities_Provider_Subject"
    ON "library"."oauth_identities" ("provider", "ProviderSubject");
CREATE INDEX IF NOT EXISTS "IX_oauth_identities_UserId"
    ON "library"."oauth_identities" ("UserId");
