// Builds apply-supabase.sql: the EF migration SQL and the library seed as ONE paste for the
// Supabase SQL editor, so a hosted database needs no local psql, no dotnet-ef and no tunnel.
// Run from api-server/:  node tools/make-supabase-bundle.mjs
//
// The inputs are generated elsewhere and never edited by hand:
//   supabase-schema.sql  <- dotnet ef migrations script
//   seed-library.sql     <- node tools/generate-seed.mjs
// So regenerate the inputs first if the model or the frontend data changed:
//   dotnet ef migrations script -o supabase-schema.sql   (from src/ApiServer.Infrastructure)
//   node tools/generate-seed.mjs
import { readFile, writeFile } from "node:fs/promises";

const header = `-- apply-supabase.sql — ONE paste into the Supabase SQL editor.
-- GENERATED FILE — do not edit by hand. Regenerate with:
--   node tools/make-supabase-bundle.mjs
-- schema + seed, each in its own transaction, then a verification query at the end.

`;

const verify = `
-- ---------- verification (the editor shows these counts after the run) ----------
SELECT 'content_items' AS "table", count(*) AS "rows" FROM library.content_items
UNION ALL SELECT 'categories', count(*) FROM library.categories
UNION ALL SELECT 'content_item_categories', count(*) FROM library.content_item_categories
UNION ALL SELECT 'migrations applied', count(*) FROM library."__EFMigrationsHistory";
`;

const [schema, seed] = await Promise.all([
  readFile("supabase-schema.sql", "utf8"),
  readFile("seed-library.sql", "utf8"),
]);

const bundle = `${header}${schema}\n${seed}${verify}`;
await writeFile("apply-supabase.sql", bundle, "utf8");

const counts = {
  schema: (schema.match(/^CREATE TABLE/gm) ?? []).length,
  contentRows: (seed.match(/^\s*\('(?:v|b|a|r)\d\d'/gm) ?? []).length,
};
console.log(`apply-supabase.sql written — ${bundle.split("\n").length - 1} lines, ${counts.schema} CREATE TABLE, ${counts.contentRows} seed value rows`);
