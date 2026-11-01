// Deep-equality check: every frontend record vs the API's detail endpoint response.
// Run from api-server/ with the API up:  node --experimental-strip-types tools/verify-identity.mjs
import { register } from "node:module";
register("./seed-hooks.mjs", import.meta.url);

const { articles } = await import("../../moaz-alian/src/data/library/articles.ts");
const { books } = await import("../../moaz-alian/src/data/library/books.ts");
const { research } = await import("../../moaz-alian/src/data/library/research.ts");
const { videos } = await import("../../moaz-alian/src/data/library/videos.ts");

const base = process.env.BASE ?? "http://127.0.0.1:5199";
const items = [...videos, ...books, ...articles, ...research];

const norm = (value, key) => {
  if (key === "publishedAt") return value ? new Date(value).toISOString() : null;
  if (key === "categoryIds" || key === "tags" || key === "references") {
    return [...(value ?? [])].sort().join("|");
  }
  if (key === "authorizedLinks") {
    return JSON.stringify((value ?? []).map((l) => [l.label ?? l.Label, l.url ?? l.Url].join("=")));
  }
  if (key === "thumbnailUrl" || key === "authorName" || key === "sourceUrl"
    || key === "videoId" || key === "seriesName" || key === "coverUrl" || key === "publisher"
    || key === "isbn" || key === "documentUrl" || key === "documentFormat" || key === "body"
    || key === "availability" || key === "videoProvider") {
    return value ?? null;
  }

  return value;
};

const fields = [
  "id", "type", "slug", "title", "description", "thumbnailUrl", "authorName", "sourceUrl",
  "featured", "verified", "demo", "rightsStatus", "publishedAt",
  "videoId", "videoProvider", "durationSeconds", "seriesName",
  "coverUrl", "publisher", "isbn", "publicationYear", "availability", "authorizedLinks",
  "body", "readingTimeMinutes", "references", "documentUrl", "documentFormat",
];

let checked = 0;
const problems = [];
for (const item of items) {
  const url = `${base}/api/content/${item.type}/${encodeURIComponent(item.slug)}`;
  const res = await fetch(url);
  if (!res.ok) {
    problems.push(`${item.id}: HTTP ${res.status}`);
    continue;
  }

  const api = await res.json();
  for (const field of fields) {
    const a = norm(item[field] === undefined ? null : item[field], field);
    const b = norm(api[field], field);
    if (a !== b) {
      problems.push(`${item.id}.${field}: frontend=${JSON.stringify(a)} api=${JSON.stringify(b)}`);
    }
  }

  checked++;
}

console.log(`${checked}/${items.length} records compared over ${fields.length} fields`);
if (problems.length === 0) {
  console.log("IDENTICAL — API matches the frontend dataset exactly");
} else {
  console.log(`MISMATCHES (${problems.length}):`);
  for (const p of problems.slice(0, 20)) console.log("  " + p);
  process.exitCode = 1;
}
