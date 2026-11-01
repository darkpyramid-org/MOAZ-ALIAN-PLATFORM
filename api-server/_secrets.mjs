// One-shot helper: lifts the values the user pasted from the session transcript straight into
// dotnet user-secrets without echoing them. Deleted after use.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const transcript = process.argv[2];
const raw = readFileSync(transcript, "utf8");

function lastMatch(re) {
  let out = null;
  for (const m of raw.matchAll(re)) out = m[1]; // last occurrence wins
  return out;
}

const jwtSecret = lastMatch(/SUPABASE_JWT_SECRET=\\?"([^"\\]+)/);
const dbUrl = lastMatch(/POSTGRES_URL_NON_POOLING=\\?"([^"\\]+)/);
const projectUrl = lastMatch(/SUPABASE_URL=\\?"(https:[^"\\]+)/);

const values = {
  "ConnectionStrings:Postgres": dbUrl,
  "SupabaseAuth:ProjectUrl": projectUrl,
  "SupabaseAuth:JwtSecret": jwtSecret,
};

for (const [key, value] of Object.entries(values)) {
  if (!value) {
    console.error(`MISSING: ${key}`);
    process.exit(1);
  }
  const r = spawnSync("dotnet", ["user-secrets", "set", key, value], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`FAILED to set ${key}: ${r.stderr?.trim()}`);
    process.exit(1);
  }
  console.log(`set ${key} (length ${value.length})`);
}
