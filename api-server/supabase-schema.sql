DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'library') THEN
        CREATE SCHEMA library;
    END IF;
END $EF$;
CREATE TABLE IF NOT EXISTS library."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
        IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'library') THEN
            CREATE SCHEMA library;
        END IF;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE TABLE library.categories (
        "Id" character varying(100) NOT NULL,
        "Name" character varying(120) COLLATE "ar-x-icu" NOT NULL,
        "Description" character varying(1000) COLLATE "ar-x-icu" NOT NULL,
        "SortOrder" integer NOT NULL,
        "CreatedAt" timestamp(3) with time zone NOT NULL,
        "UpdatedAt" timestamp(3) with time zone NOT NULL,
        CONSTRAINT "PK_categories" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE TABLE library.content_items (
        "Id" character varying(100) NOT NULL,
        "Tags" text NOT NULL,
        "References" text NOT NULL,
        "Type" smallint NOT NULL,
        "Slug" character varying(200) NOT NULL,
        "Title" character varying(300) COLLATE "ar-x-icu" NOT NULL,
        "Description" character varying(2000) COLLATE "ar-x-icu" NOT NULL,
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
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE TABLE library.content_item_categories (
        "CategoriesId" character varying(100) NOT NULL,
        "ContentItemsId" character varying(100) NOT NULL,
        CONSTRAINT "PK_content_item_categories" PRIMARY KEY ("CategoriesId", "ContentItemsId"),
        CONSTRAINT "FK_content_item_categories_categories_CategoriesId" FOREIGN KEY ("CategoriesId") REFERENCES library.categories ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_content_item_categories_content_items_ContentItemsId" FOREIGN KEY ("ContentItemsId") REFERENCES library.content_items ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE INDEX "IX_categories_SortOrder_Name" ON library.categories ("SortOrder", "Name");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE INDEX "IX_content_item_categories_ContentItemsId" ON library.content_item_categories ("ContentItemsId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE INDEX "IX_content_items_Featured" ON library.content_items ("Featured");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE INDEX "IX_content_items_PublishedAt" ON library.content_items ("PublishedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE INDEX "IX_content_items_SeriesName" ON library.content_items ("SeriesName");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE INDEX "IX_content_items_Type_PublishedAt" ON library.content_items ("Type", "PublishedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_content_items_Type_Slug" ON library.content_items ("Type", "Slug");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM library."__EFMigrationsHistory" WHERE "MigrationId" = '20261031233722_InitialCreate') THEN
    INSERT INTO library."__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261031233722_InitialCreate', '9.0.9');
    END IF;
END $EF$;
COMMIT;

