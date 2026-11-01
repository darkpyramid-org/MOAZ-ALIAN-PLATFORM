// Proves the frontend's read path yields exactly the records it used to bundle.
// Runs the REAL mapper (moaz-alian/src/lib/api-mapping.ts) against the live API,
// field by field, against the frontend's own arrays.
// From api-server/, with the API up:
//   node --experimental-strip-types tools/verify-frontend-mapping.mjs
import { register } from "node:module";
register("./seed-hooks.mjs", import.meta.url);

const { libraryItems } = await import("../../moaz-alian/src/data/library/index.ts");
const { toContentItem } = await import("../../moaz-alian/src/lib/api-mapping.ts");

const base = process.env.BASE ?? "http://127.0.0.1:5199";

const res = await fetch(`${base}/api/content/snapshot`);
if (!res.ok) {
  console.error(`snapshot endpoint returned HTTP ${res.status}`);
  process.exit(1);
}
const mapped = (await res.json()).map(toContentItem);

// Order differs by design (the API returns newest first), so compare by id.
const expected = new Map(libraryItems.map((item) => [item.id, item]));
const sorted = (value) =>
  Array.isArray(value)
    ? [...value]
        .map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)))
        .sort()
        .join("|")
    : value;

const fields = [
  "slug", "title", "description", "thumbnailUrl", "authorName", "sourceUrl", "body",
  "categoryIds", "tags", "featured", "verified", "demo", "rightsStatus", "publishedAt",
  "videoId", "videoProvider", "durationSeconds", "seriesName",
  "coverUrl", "publisher", "isbn", "publicationYear", "availability", "authorizedLinks",
  "readingTimeMinutes", "references", "documentUrl", "documentFormat", "type",
];

const problems = [];
for (const item of mapped) {
  const want = expected.get(item.id);
  if (!want) {
    problems.push(`${item.id}: present in the API, absent from the frontend dataset`);
    continue;
  }
  for (const field of fields) {
    const a = sorted(want[field] ?? null);
    const b = sorted(item[field] ?? null);
    if (a !== b) {
      problems.push(`${item.id}.${field}\n      frontend=${JSON.stringify(a)}\n      api→UI  =${JSON.stringify(b)}`);
    }
  }
  // The store keys lookups on `id` too, so a mapping that renames ids would break
  // every detail route while still passing the field checks above.
  if (want.id !== item.id) problems.push(`${item.id}: id was rewritten to ${item.id}`);
}

for (const id of expected.keys()) {
  if (!mapped.some((item) => item.id === id)) {
    problems.push(`${id}: in the frontend dataset, missing from the mapped API response`);
  }
}

console.log(`${mapped.length} mapped records vs ${expected.size} frontend records, ${fields.length} fields each`);
if (problems.length === 0) {
  console.log("IDENTICAL — the frontend reads exactly the objects it used to bundle");
} else {
  console.log(`MISMATCHES (${problems.length}):`);
  for (const p of problems.slice(0, 25)) console.log("  " + p);
  process.exitCode = 1;
}
