-- Baseline migration for the Express API.
--
-- This file reproduces the physical `library` schema exactly as the ASP.NET
-- API owns it today:
--   1. tables + indexes from the EF Core migration 20261031233722_InitialCreate
--      (api-server/src/ApiServer.Infrastructure/Migrations/…), and
--   2. the startup DDL Program.cs executes on every boot (users, site_settings,
--      debates), because those tables predate the EF migration history,
--   3. plus the NEW chat tables (migration decision D3) — additive only.
--
-- Identifier names, column types, collations, defaults and index names are
-- kept byte-identical so one database can serve both runtimes during rollout.
-- This migration must NEVER run against the production database outside an
-- approved rollout: `prisma migrate deploy` on a disposable database is the
-- only supported path in tests/CI.

CREATE SCHEMA IF NOT EXISTS "library";

-- ===========================================================================
-- 1. EF Core InitialCreate (content + categories)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "library"."categories" (
    "Id" character varying(100) NOT NULL,
    "Name" character varying(120) NOT NULL COLLATE "ar-x-icu",
    "Description" character varying(1000) NOT NULL COLLATE "ar-x-icu",
    "SortOrder" integer NOT NULL,
    "CreatedAt" timestamp(3) with time zone NOT NULL,
    "UpdatedAt" timestamp(3) with time zone NOT NULL,
    CONSTRAINT "PK_categories" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS "library"."content_items" (
    "Id" character varying(100) NOT NULL,
    "Tags" text NOT NULL,
    "References" text NOT NULL,
    "Type" smallint NOT NULL,
    "Slug" character varying(200) NOT NULL,
    "Title" character varying(300) NOT NULL COLLATE "ar-x-icu",
    "Description" character varying(2000) NOT NULL COLLATE "ar-x-icu",
    "ThumbnailUrl" character varying(2048),
    "AuthorName" character varying(200) COLLATE "ar-x-icu",
    "SourceUrl" character varying(2048),
    "Body" text,
    "Featured" boolean NOT NULL,
    "Verified" boolean NOT NULL,
    "Demo" boolean NOT NULL,
    "RightsStatus" smallint NOT NULL,
    "PublishedAt" timestamp(3) with time zone,
    "CreatedAt" timestamp(3) with time zone NOT NULL,
    "UpdatedAt" timestamp(3) with time zone NOT NULL,
    "VideoId" character varying(64),
    "VideoProvider" smallint,
    "DurationSeconds" integer,
    "SeriesName" character varying(200) COLLATE "ar-x-icu",
    "CoverUrl" character varying(2048),
    "Publisher" character varying(200),
    "Isbn" character varying(20),
    "PublicationYear" integer,
    "Availability" smallint,
    "ReadingTimeMinutes" integer,
    "DocumentUrl" character varying(2048),
    "DocumentFormat" character varying(20),
    "AuthorizedLinks" jsonb,
    CONSTRAINT "PK_content_items" PRIMARY KEY ("Id")
);

CREATE TABLE IF NOT EXISTS "library"."content_item_categories" (
    "CategoriesId" character varying(100) NOT NULL,
    "ContentItemsId" character varying(100) NOT NULL,
    CONSTRAINT "PK_content_item_categories" PRIMARY KEY ("CategoriesId", "ContentItemsId"),
    CONSTRAINT "FK_content_item_categories_categories_CategoriesId" FOREIGN KEY ("CategoriesId")
        REFERENCES "library"."categories" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_content_item_categories_content_items_ContentItemsId" FOREIGN KEY ("ContentItemsId")
        REFERENCES "library"."content_items" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_categories_SortOrder_Name" ON "library"."categories" ("SortOrder", "Name");
CREATE INDEX IF NOT EXISTS "IX_content_item_categories_ContentItemsId" ON "library"."content_item_categories" ("ContentItemsId");
CREATE INDEX IF NOT EXISTS "IX_content_items_Featured" ON "library"."content_items" ("Featured");
CREATE INDEX IF NOT EXISTS "IX_content_items_PublishedAt" ON "library"."content_items" ("PublishedAt");
CREATE INDEX IF NOT EXISTS "IX_content_items_SeriesName" ON "library"."content_items" ("SeriesName");
CREATE INDEX IF NOT EXISTS "IX_content_items_Type_PublishedAt" ON "library"."content_items" ("Type", "PublishedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_content_items_Type_Slug" ON "library"."content_items" ("Type", "Slug");

-- ===========================================================================
-- 2. Program.cs startup DDL (users / site_settings / debates)
--    The backfill ALTERs are folded into the CREATE for fresh databases.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "library"."users" (
    "Id" UUID PRIMARY KEY,
    "Email" character varying(255) NOT NULL,
    "PasswordHash" character varying(1000) NOT NULL,
    "Roles" text[] NOT NULL DEFAULT ARRAY[]::text[],
    "DisplayName" character varying(80),
    "AvatarUrl" character varying(500000),
    "PasswordResetToken" character varying(200),
    "PasswordResetExpiresAt" timestamp(3) with time zone,
    "CreatedAt" timestamp(3) with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp(3) with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_users_Email" ON "library"."users" ("Email");

CREATE TABLE IF NOT EXISTS "library"."site_settings" (
    "Id" text PRIMARY KEY,
    "Data" text NOT NULL DEFAULT '{}',
    "UpdatedAt" timestamp(3) with time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "library"."debates" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "GuestName" text NOT NULL,
    "GuestBackground" text,
    "Topic" text NOT NULL,
    "ReplySummary" text,
    "Outcome" text NOT NULL DEFAULT 'open',
    "DebateDate" text,
    "VideoUrl" text,
    "Tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
    "Notes" text,
    "CreatedAt" timestamp(3) with time zone NOT NULL DEFAULT NOW()
);

-- ===========================================================================
-- 3. NEW: server-side chat persistence (migration decision D3). Additive only;
--    the legacy schema is untouched. Same PascalCase column style for
--    consistency with the rest of the schema.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "library"."chat_threads" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "UserId" uuid NOT NULL,
    "Title" text,
    "CreatedAt" timestamp(3) with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp(3) with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_chat_threads_users_UserId" FOREIGN KEY ("UserId")
        REFERENCES "library"."users" ("Id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "library"."chat_messages" (
    "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "ThreadId" uuid NOT NULL,
    "Role" text NOT NULL,
    "Content" text NOT NULL,
    "CreatedAt" timestamp(3) with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_chat_messages_chat_threads_ThreadId" FOREIGN KEY ("ThreadId")
        REFERENCES "library"."chat_threads" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_chat_threads_UserId" ON "library"."chat_threads" ("UserId");
CREATE INDEX IF NOT EXISTS "IX_chat_messages_ThreadId" ON "library"."chat_messages" ("ThreadId");
