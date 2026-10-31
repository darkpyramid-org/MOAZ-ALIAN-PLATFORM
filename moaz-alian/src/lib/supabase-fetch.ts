// Shared Supabase REST fetch wrapper: opaque new API keys (sb_publishable_ /
// sb_secret_) are not bearer JWTs, so the key travels only as `apikey` and a
// matching Authorization header is stripped. Single hand-maintained copy —
// used by chat.server.ts and library.functions.ts; the generated files under
// src/integrations/supabase keep their own platform-managed copy.
export function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}
