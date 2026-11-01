-- apply-supabase.sql — ONE paste into the Supabase SQL editor.
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   node tools/make-supabase-bundle.mjs
-- schema + seed, each in its own transaction, then a verification query at the end.

﻿DO $EF$
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


-- Generated by tools/generate-seed.mjs from moaz-alian/src/data — do not edit by hand.
-- Idempotent: re-running refreshes every row in place (upsert), matching the frontend arrays.

BEGIN;

TRUNCATE library.content_item_categories;

INSERT INTO library.categories ("Id", "Name", "Description", "SortOrder", "CreatedAt", "UpdatedAt")
VALUES
  ('comparative', 'مقارنة الأديان', 'مواد تقارن بين العقائد والنصوص والتعاليم بين الأديان.', 1, now(), now()),
  ('christianity', 'المسيحية', 'مواد تتعلق بعقائد المسيحية وتاريخها ونصوصها.', 2, now(), now()),
  ('islam', 'الإسلام', 'مواد تتعلق بالعقيدة الإسلامية والرد على ما يطعن فيها.', 3, now(), now()),
  ('texts', 'النصوص الدينية', 'قراءات ودراسات في النصوص الدينية وتاريخها.', 4, now(), now()),
  ('responses', 'الشبهات والردود', 'حلقات ومواد للرد على الشبهات المثارة حول الإسلام.', 5, now(), now()),
  ('dialogues', 'الحوارات والمناظرات', 'حوارات ومناظرات مسجلة مع خصوم ومهتمين.', 6, now(), now()),
  ('intellectual', 'القضايا الفكرية', 'قضايا العقل والعلمانية والقيم في الفكر المعاصر.', 7, now(), now()),
  ('series', 'البرامج والسلاسل', 'برامج وسلاسل تعليمية مرتبة على قناة معاذ عليان.', 8, now(), now())
ON CONFLICT ("Id") DO UPDATE SET
  "Name" = EXCLUDED."Name", "Description" = EXCLUDED."Description",
  "SortOrder" = EXCLUDED."SortOrder", "UpdatedAt" = now();

INSERT INTO library.content_items
  ("Id", "Type", "Slug", "Title", "Description", "ThumbnailUrl", "AuthorName", "SourceUrl",
   "Tags", "Featured", "Verified", "Demo", "RightsStatus", "PublishedAt", "CreatedAt", "UpdatedAt",
   "VideoId", "VideoProvider", "DurationSeconds", "SeriesName",
   "CoverUrl", "Publisher", "Isbn", "PublicationYear", "Availability", "AuthorizedLinks",
   "Body", "ReadingTimeMinutes", "References", "DocumentUrl", "DocumentFormat")
VALUES
  ('v01', 1, 'shenouda-full-story', 'الطفل شنودة سابقا .. القصة كاملة من زاوية مختلفة', 'حلقة عن قضية الطفل شنودة، والقصة كاملة من زاوية مختلفة.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["قضايا معاصرة"]', true, true, false, 3, '2023-03-22T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v02', 1, 'zakaria-botros-marji', 'فضيحة والله .. زكريا بطرس بيستشهد من مرجع ويحذف منه', 'حلقة ناقدة لاستشهاد زكريا بطرس بمرجع ديني مع حذف جزء منه.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["زكريا بطرس"]', false, true, false, 3, '2023-03-18T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v03', 1, 'priest-converts-islam', 'كاهن مسيحي شهير يعلن اعتناقه الإسلام وتركه المسيحية', 'حلقة تغطي إعلان كاهن مسيحي شهير اعتناقه الإسلام.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["قصص اعتناق الإسلام"]', true, true, false, 3, '2023-02-26T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v04', 1, 'ermia-boulos-trap', 'صاعقة جديدة!! القمص إرميا بولس يقع في مصيدة .. اتحداك ترد على الفيديو ده!', 'حلقة على قناة معاذ عليان للرد على القمص إرميا بولس.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["مناظرات"]', false, true, false, 3, '2023-02-21T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v05', 1, 'western-study-friendship', 'دراسة غربية تؤكد: لا يمكن يكون في صداقة بين الرجل والمرأة!', 'حلقة حول دراسة غربية عن الصداقة بين الرجل والمرأة وقراءة نقدية فيها.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["قضايا فكرية"]', false, true, false, 3, '2023-02-13T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v06', 1, 'early-church-fathers-bible', 'مفاجأة صادمة.. القساوسة الأوائل رفضوا الكتاب المقدس الذي بين أيدي النصارى الآن!!', 'حلقة عن موقف آباء الكنيسة الأوائل من النص الكتابي.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["نصوص"]', true, true, false, 3, '2023-02-13T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v07', 1, 'christianity-reason', 'هل المسيحية بالعقل؟ مراجع مسيحية تؤكد: اوعى تفكر بعقلك', 'حلقة تناقش علاقة العقل بالمسيحية بالاستناد إلى مراجع مسيحية.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["العقل والوحي"]', false, true, false, 3, '2023-01-31T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v08', 1, 'bimon-luka-trap', 'القمص بيمن لوقا يقع في شباك معاذ عليان .. فيديو هتستغرب القمص بسببه!', 'حلقة من قناة معاذ عليان تتناول حوارًا مع القمص بيمن لوقا.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["مناظرات"]', false, true, false, 3, '2023-01-31T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v09', 1, 'mary-mother-of-god', 'مفاجأة .. قس مسيحي يقول عن مريم أنها أم اللاهوت وأم من خلقها!!', 'حلقة تناقش أقوالًا منسوبة لقسٍّ مسيحي حول مريم.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["مريم"]', false, true, false, 3, '2023-01-26T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v10', 1, 'ilham-shahin-shaarawy', 'مذيع مسلم يقصف جبهة إلهام شاهين بعد اتهامها للشعراوي!', 'حلقة تتناول اتهامات إلهام شاهين للشعراوي وردًا عليها.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["إعلام"]', false, true, false, 3, '2023-01-17T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v11', 1, 'preacher-avoids-question', 'واعظ أرثوذكسي يتهرب من مسلم في مجرد سؤال في المسيحية', 'حلقة توثق حوارًا مع واعظ أرثوذكسي حول سؤال في المسيحية.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["حوارات"]', false, true, false, 3, '2023-01-12T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v12', 1, 'christian-challenge-response', 'مسيحي يتحدى مسلم: الحمد لله على نعمة المسيحية .. فشاهد الرد الصاعق', 'حلقة توثق تحديًا بين مسيحي ومسلم والرد عليه.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["مناظرات"]', false, true, false, 3, '2023-01-09T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v13', 1, 'pope-tawadros-confession', 'لأول مرة .. البابا تواضروس يدخل غرفة الاعتراف ويعترف اعترافات خطيرة عن الكتاب المقدس', 'حلقة عن تصريحات منسوبة للبابا تواضروس حول الكتاب المقدس.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["نصوص"]', false, true, false, 3, '2023-01-06T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v14', 1, 'christian-books-god', 'كوارث الكتب المسيحية عن الله .. الفيديو ده كفيل يصدمك بدون مبالغة!', 'حلقة تعرض مقارنات بين كتب مسيحية في تعريفها لله.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["عقائد"]', false, true, false, 3, '2023-01-02T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v15', 1, 'miracle-cyril', 'معجزة الأنبا كيرلس .. دخل الجنة!', 'حلقة نقدية حول رواية معجزة منسوبة للأنبا كيرلس.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["معجزات"]', false, true, false, 3, '2022-12-29T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v16', 1, 'zakaria-botros-weak-god', 'اعتراف خطير .. زكريا بطرس: إلهي دودة يعني ضعيف', 'حلقة ناقدة لقول منسوب لزكريا بطرس عن إلهه.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["زكريا بطرس"]', false, true, false, 3, '2022-12-16T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v17', 1, 'fatima-naout-article', 'فاطمة ناعوت .. ياسين بيشوي .. المقال المسخرة!!', 'حلقة حول مقال مثير للجدل وردود فعل عليه.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["إعلام"]', false, true, false, 3, '2022-12-11T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v18', 1, 'britain-report', 'تقرير بريطاني: انهيار المسيحية وانتشار الإسلام في بريطانيا', 'حلقة حول تقرير بريطاني عن تحولات ديموغرافية دينية.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["تقارير"]', false, true, false, 3, '2022-12-03T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('v19', 1, 'pope-shenouda-athanasius', 'اعتراف رسمي للبابا شنودة: أثناسيوس الرسولي معدد للآلهة', 'حلقة عن أقوال منسوبة للبابا شنودة حول أثناسيوس الرسولي.', NULL, 'معاذ عليان', 'https://tanwery.com/category/%D9%85%D8%B9%D8%A7%D8%B0-%D8%B9%D9%84%D9%8A%D8%A7%D9%86/', '["نصوص"]', false, true, false, 3, '2022-12-02T00:00:00+00:00', now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('b01', 2, 'muqaddimat-hiwar-nasraniyyat', 'مقدمات في حوار النصرانيات', 'كتاب في أسس الحوار مع النصرانيات.', NULL, 'معاذ عليان', 'https://www.islamland.com/ose/authors/731', '["حوار"]', true, true, false, 3, NULL, now(), now(), NULL, NULL, NULL, NULL, 'https://www.islamland.com/uploads/books/mokademat_arb.JPG', NULL, NULL, NULL, 1, '[{"Label":"قراءة الكتاب على إسلام لاند","Url":"https://www.islamland.com/ose/books/%D9%85%D9%82%D8%AF%D9%85%D8%A7%D8%AA-%D9%81%D9%89-%D8%AD%D9%88%D8%A7%D8%B1-%D8%A7%D9%84%D9%86%D8%B5%D8%B1%D8%A7%D9%86%D9%8A%D8%A7%D8%AA-1442557736"}]', NULL, NULL, '[]', NULL, NULL),
  ('b02', 2, 'rasul-islam-ashraf-alkhalq', 'هل رسول الإسلام أشرف الخلق؟ وهل يستحق هذا اللقب؟', 'كتاب يبحث في لقب «أشرف الخلق» الممنوح للنبي محمد ﷺ.', NULL, 'معاذ عليان', 'https://www.islamland.com/ose/authors/731', '["السيرة"]', false, true, false, 3, NULL, now(), now(), NULL, NULL, NULL, NULL, 'https://www.islamland.com/uploads/books/%D9%87%D9%84%20%D8%B1%D8%B3%D9%88%D9%84%20%D8%A7%D9%84%D8%A5%D8%B3%D9%84%D8%A7%D9%85%20%D8%A3%D8%B4%D8%B1%D9%81%20%D8%A7%D9%84%D8%AE%D9%84%D9%82%20%20%D9%88%D9%87%D9%84%20%D9%8A%D8%B3%D8%AA%D8%AD%D9%82%20%D9%87%D8%B0%D8%A7%20%D8%A7%D9%84%D9%84%D9%82%D8%A8.JPG', NULL, NULL, NULL, 1, '[{"Label":"قراءة الكتاب على إسلام لاند","Url":"https://www.islamland.com/ose/books/%D9%87%D9%84-%D8%B1%D8%B3%D9%88%D9%84-%D8%A7%D9%84%D8%A5%D8%B3%D9%84%D8%A7%D9%85-%D8%A3%D8%B4%D8%B1%D9%81-%D8%A7%D9%84%D8%AE%D9%84%D9%82-%D9%88%D9%87%D9%84-%D9%8A%D8%B3%D8%AA%D8%AD%D9%82-%D9%87%D8%B0%D8%A7-%D8%A7%D9%84%D9%84%D9%82%D8%A8-1468523926"}]', NULL, NULL, '[]', NULL, NULL),
  ('b03', 2, 'mujizat-sayyid-mursalin', 'معجزات سيد المرسلين تتحدى المشككين', 'كتاب يعرض معجزات النبي محمد ﷺ ويجيب عن المشككين فيها.', NULL, 'معاذ عليان', 'https://www.islamland.com/ose/authors/731', '["المعجزات"]', false, true, false, 3, NULL, now(), now(), NULL, NULL, NULL, NULL, 'https://www.islamland.com/uploads/books/%D9%85%D8%B9%D8%AC%D8%B2%D8%A7%D8%AA%20%D8%B3%D9%8A%D8%AF%20%D8%A7%D9%84%D9%85%D8%B1%D8%B3%D9%84%D9%8A%D9%86%20%D8%AA%D8%AA%D8%AD%D8%AF%D9%89%20%D8%A7%D9%84%D9%85%D8%B4%D9%83%D9%83%D9%8A%D9%86.JPG', NULL, NULL, NULL, 1, '[{"Label":"قراءة الكتاب على إسلام لاند","Url":"https://www.islamland.com/ose/books/%D9%85%D8%B9%D8%AC%D8%B2%D8%A7%D8%AA-%D8%B3%D9%8A%D8%AF-%D8%A7%D9%84%D9%85%D8%B1%D8%B3%D9%84%D9%8A%D9%86-%D8%AA%D8%AA%D8%AD%D8%AF%D9%89-%D8%A7%D9%84%D9%85%D8%B4%D9%83%D9%83%D9%8A%D9%86-1468524113"}]', NULL, NULL, '[]', NULL, NULL),
  ('b04', 2, 'ibadat-maryam', 'عبادة مريم في المسيحية والظهورات المريمية', 'كتاب يبحث في موقف المسيحية من مريم والظهورات المنسوبة لها.', NULL, 'معاذ عليان', 'https://www.islamland.com/ose/authors/731', '["مريم"]', false, true, false, 3, NULL, now(), now(), NULL, NULL, NULL, NULL, 'https://www.islamland.com/uploads/books/%D9%83%D8%AA%D8%A7%D8%A8%20%D8%B9%D8%A8%D8%A7%D8%AF%D8%A9%20%D9%85%D8%B1%D9%8A%D9%85%20%D9%81%D9%8A%20%D8%A7%D9%84%D9%85%D8%B3%D9%8A%D8%AD%D9%8A%D8%A9%20%D9%88%D8%A7%D9%84%D8%B8%D9%87%D9%88%D8%B1%D8%A7%D8%AA%20%D8%A7%D9%84%D9%85%D8%B1%D9%8A%D9%85%D9%8A%D8%A9.JPG', NULL, NULL, NULL, 1, '[{"Label":"قراءة الكتاب على إسلام لاند","Url":"https://www.islamland.com/ose/books/%D9%83%D8%AA%D8%A7%D8%A8-%D8%B9%D8%A8%D8%A7%D8%AF%D8%A9-%D9%85%D8%B1%D9%8A%D9%85-%D9%81%D9%8A-%D8%A7%D9%84%D9%85%D8%B3%D9%8A%D8%AD%D9%8A%D8%A9-%D9%88%D8%A7%D9%84%D8%B8%D9%87%D9%88%D8%B1%D8%A7%D8%AA-%D8%A7%D9%84%D9%85%D8%B1%D9%8A%D9%85%D9%8A%D8%A9-1468524360"}]', NULL, NULL, '[]', NULL, NULL),
  ('b05', 2, 'ghazawat-islam', 'غزوات الإسلام تتحدى البهتان', 'كتاب يجيب عن البهتان المثار حول غزوات الإسلام.', NULL, 'معاذ عليان', 'https://www.islamland.com/ose/authors/731', '["السيرة"]', false, true, false, 3, NULL, now(), now(), NULL, NULL, NULL, NULL, 'https://www.islamland.com/uploads/books/%D8%BA%D8%B2%D9%88%D8%A7%D8%AA%20%D8%A7%D9%84%D8%A5%D8%B3%D9%84%D8%A7%D9%85%20%D8%AA%D8%AA%D8%AD%D8%AF%D9%89%20%D8%A7%D9%84%D8%A8%D9%87%D8%AA%D8%A7%D9%86.JPG', NULL, NULL, NULL, 1, '[{"Label":"قراءة الكتاب على إسلام لاند","Url":"https://www.islamland.com/ose/books/%D8%BA%D8%B2%D9%88%D8%A7%D8%AA-%D8%A7%D9%84%D8%A5%D8%B3%D9%84%D8%A7%D9%85-%D8%AA%D8%AA%D8%AD%D8%AF%D9%89-%D8%A7%D9%84%D8%A8%D9%87%D8%AA%D8%A7%D9%86-1468525069"}]', NULL, NULL, '[]', NULL, NULL),
  ('a01', 3, 'zamili-almasihi', 'زميلي المسيحي نُحِبُّ لك الخير', 'مقال منشور على منصة إسلام لاند.', NULL, 'معاذ عليان', 'https://www.islamland.com/ose/articles/zamily-almaseehi', '["مقالات"]', true, true, false, 3, NULL, now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('a02', 3, 'kayfa-naqra-nusus', 'كيف نقرأ النصوص الدينية بموضوعية؟', 'مقال تجريبي لعرض تجربة القراءة الطويلة في الموقع.', NULL, 'معاذ عليان', NULL, '["منهج"]', false, false, true, 4, NULL, now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, 'هذا المقال **محتوى تجريبي** وُضع لعرض تجربة القراءة في الموقع فقط، ولا يمثل نصًا منشورًا حقيقيًا.

## لماذا تهم الموضوعية؟

الموضوعية في قراءة النصوص الدينية تعني البحث عن معنى النص في سياقه، لا في افتراضاتنا المسبقة عنه. ويحتاج القارئ إلى أدوات واضحة تمكنه من التمييز بين النص وشرحه.

## خطوات عملية

1. تحديد سياق النص: من قالها؟ ومتى؟ ولمن؟
2. النظر إلى النسخ والترجمات المتوفرة ومقارنة الفروق.
3. جمع أقوال المفسّرين المختلفين قبل الحكم.
4. صياغة نتيجة محدودة بما وُجد من الأدلة.

## خاتمة

الغاية ليست الفوز في جدال، بل الاقتراب من فهم أدق. وهذه الخطوات قابلة للتطبيق على أي نص ديني يدرسه القارئ.', 4, '[]', NULL, NULL),
  ('a03', 3, 'manhaj-alradd-ala-shubuhat', 'منهجية الرد على الشبهات: خمس خطوات', 'مقال تجريبي يعرض منهجًا مقترحًا للتعامل مع الشبهات.', NULL, 'معاذ عليان', NULL, '["منهج"]', false, false, true, 4, NULL, now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, 'هذا المقال **محتوى تجريبي** وُضع لعرض تجربة القراءة في الموقع فقط، ولا يمثل نصًا منشورًا حقيقيًا.

## لماذا نحتاج منهجًا؟

التعامل مع الشبهات بردود متسرعة يفتح باب اللبس. المنهج يجعل الرد أقرب إلى البحث منه إلى الجدال.

## الخطوات الخمس

1. **نقل الشبهة بأمانة**: بنص كامل ومصدرها.
2. **فهم مقصودها**: ما السؤال الحقيقي المطروح؟
3. **جمع الأدلة**: من النصوص والمصادر الموثوقة.
4. **صياغة الرد**: بلغة واضحة بلا مبالغة.
5. **مراجعة الرد**: هل يجيب عن الشبهة نفسها فعلًا؟

## خلاصة

الرد الجيد يبدأ بالإنصاف، وينتهي بالوضوح لا بالاستعراض.', 3, '[]', NULL, NULL),
  ('r01', 4, 'marja-nusus-ahd-jadid', 'مجموعة مراجع حول نصوص العهد الجديد', 'سجل تجريبي لمجموعة مراجع بحثية؛ سيُستبدل بمواد موثقة عند توفرها.', NULL, 'معاذ عليان', NULL, '["مراجع"]', false, false, true, 4, NULL, now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL),
  ('r02', 4, 'asila-shaia-muqarana', 'أسئلة شائعة في مقارنة الأديان', 'سجل تجريبي لمجموعة أسئلة بحثية؛ سيُستبدل بمواد موثقة عند توفرها.', NULL, 'معاذ عليان', NULL, '["أسئلة"]', false, false, true, 4, NULL, now(), now(), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, '[]', NULL, NULL)
ON CONFLICT ("Id") DO UPDATE SET
  "Type" = EXCLUDED."Type", "Slug" = EXCLUDED."Slug", "Title" = EXCLUDED."Title",
  "Description" = EXCLUDED."Description", "ThumbnailUrl" = EXCLUDED."ThumbnailUrl",
  "AuthorName" = EXCLUDED."AuthorName", "SourceUrl" = EXCLUDED."SourceUrl",
  "Tags" = EXCLUDED."Tags", "Featured" = EXCLUDED."Featured", "Verified" = EXCLUDED."Verified",
  "Demo" = EXCLUDED."Demo", "RightsStatus" = EXCLUDED."RightsStatus",
  "PublishedAt" = EXCLUDED."PublishedAt", "UpdatedAt" = now(),
  "VideoId" = EXCLUDED."VideoId", "VideoProvider" = EXCLUDED."VideoProvider",
  "DurationSeconds" = EXCLUDED."DurationSeconds", "SeriesName" = EXCLUDED."SeriesName",
  "CoverUrl" = EXCLUDED."CoverUrl", "Publisher" = EXCLUDED."Publisher",
  "Isbn" = EXCLUDED."Isbn", "PublicationYear" = EXCLUDED."PublicationYear",
  "Availability" = EXCLUDED."Availability", "AuthorizedLinks" = EXCLUDED."AuthorizedLinks",
  "Body" = EXCLUDED."Body", "ReadingTimeMinutes" = EXCLUDED."ReadingTimeMinutes",
  "References" = EXCLUDED."References", "DocumentUrl" = EXCLUDED."DocumentUrl",
  "DocumentFormat" = EXCLUDED."DocumentFormat";

INSERT INTO library.content_item_categories ("CategoriesId", "ContentItemsId")
VALUES
  ('responses', 'v01'),
  ('christianity', 'v01'),
  ('responses', 'v02'),
  ('christianity', 'v02'),
  ('dialogues', 'v03'),
  ('comparative', 'v03'),
  ('dialogues', 'v04'),
  ('intellectual', 'v05'),
  ('texts', 'v06'),
  ('christianity', 'v06'),
  ('comparative', 'v07'),
  ('intellectual', 'v07'),
  ('dialogues', 'v08'),
  ('comparative', 'v09'),
  ('christianity', 'v09'),
  ('responses', 'v10'),
  ('dialogues', 'v11'),
  ('dialogues', 'v12'),
  ('comparative', 'v12'),
  ('texts', 'v13'),
  ('responses', 'v13'),
  ('comparative', 'v14'),
  ('responses', 'v15'),
  ('responses', 'v16'),
  ('responses', 'v17'),
  ('intellectual', 'v17'),
  ('comparative', 'v18'),
  ('islam', 'v18'),
  ('texts', 'v19'),
  ('responses', 'v19'),
  ('comparative', 'b01'),
  ('islam', 'b02'),
  ('islam', 'b03'),
  ('responses', 'b03'),
  ('comparative', 'b04'),
  ('christianity', 'b04'),
  ('islam', 'b05'),
  ('responses', 'b05'),
  ('comparative', 'a01'),
  ('dialogues', 'a01'),
  ('texts', 'a02'),
  ('responses', 'a03'),
  ('texts', 'r01'),
  ('christianity', 'r01'),
  ('comparative', 'r02')
ON CONFLICT DO NOTHING;

COMMIT;

-- ---------- verification (the editor shows these counts after the run) ----------
SELECT 'content_items' AS "table", count(*) AS "rows" FROM library.content_items
UNION ALL SELECT 'categories', count(*) FROM library.categories
UNION ALL SELECT 'content_item_categories', count(*) FROM library.content_item_categories
UNION ALL SELECT 'migrations applied', count(*) FROM library."__EFMigrationsHistory";
