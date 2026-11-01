// Contract check for the frontend's WRITE path, using no credentials.
//
// toUpsertRequest() in moaz-alian/src/lib/api-mapping.ts builds the JSON body the API
// binds to UpsertContentItemRequest / UpsertCategoryRequest. A property the backend
// doesn't declare is silently dropped, and a missing required one is a 400 — both fail
// closed, so this compares the mapper's output against the API's own OpenAPI schema.
//
// From api-server/, with the API up:
//   node --experimental-strip-types tools/verify-write-contract.mjs
import { register } from "node:module";
register("./seed-hooks.mjs", import.meta.url);

const { libraryItems } = await import("../../moaz-alian/src/data/library/index.ts");
const { toUpsertRequest } = await import("../../moaz-alian/src/lib/api-mapping.ts");

const base = process.env.BASE ?? "http://127.0.0.1:5199";
const doc = await (await fetch(`${base}/openapi/v1.json`)).json();

const declared = (name) => {
  const schema = doc.components?.schemas?.[name];
  if (!schema) throw new Error(`${name} is absent from the OpenAPI document`);
  return { props: new Set(Object.keys(schema.properties ?? {})), required: new Set(schema.required ?? []) };
};

const problems = [];
function compare(label, sent, schemaName) {
  const { props, required } = declared(schemaName);
  const keys = new Set(Object.keys(sent));

  for (const key of keys) if (!props.has(key)) problems.push(`${label}: sends '${key}', the API has no such property`);
  for (const key of required) if (!keys.has(key)) problems.push(`${label}: required '${key}' is missing from the payload`);
  return `${keys.size} of ${props.size} declared properties`;
}

// One record per content type, plus an edit (slug present) and a create (slug omitted).
const seen = new Set();
const samples = [];
for (const item of libraryItems) {
  if (seen.has(item.type)) continue;
  seen.add(item.type);
  samples.push([item, `${item.type} create`]);
  samples.push([item, `${item.type} edit`]);
}

const lines = [];
for (const [item, label] of samples) {
  const payload = toUpsertRequest(item, label.endsWith("edit") ? item.slug : "");
  lines.push(`  ${label.padEnd(16)} ${compare(label, payload, "UpsertContentItemRequest")}`);
}

// Categories: the dashboard hands the API { id, name, description, sortOrder }.
const categoryPayload = { id: "test", name: "تجربة", description: "", sortOrder: 0 };
lines.push(`  category         ${compare("category", categoryPayload, "UpsertCategoryRequest")}`);

console.log(lines.join("\n"));
console.log(`${seen.size} content types x 2 modes checked against the live OpenAPI schema`);
if (problems.length === 0) {
  console.log("MATCH — every payload the frontend can build is one the API will accept");
} else {
  console.log(`DRIFT (${problems.length}):`);
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
