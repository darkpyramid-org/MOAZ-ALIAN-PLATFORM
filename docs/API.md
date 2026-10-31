# API

Server routes are implemented with TanStack Start under `moaz-alian/src/routes/api/`.

## `POST /api/chat`

Authenticated chat proxy to the Lovable AI gateway.

- Requires a valid user session and thread ownership checks in server code.
- Server env: `LOVABLE_API_KEY`, Supabase URL/keys as used by chat server helpers.

## `GET /api/media/$`

Proxies or serves media object paths with path validation (rejects `..` and invalid object paths).

- Server env: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY` fallback).

## Not implemented

Historical docs that listed a standalone Express API on `localhost:3000` with a full CRUD REST surface do **not** match this repository. Prefer the routes above and Supabase client calls from the app.
