# API

## Backend — `api-server/` (ASP.NET Core, http://localhost:5199)

Full reference lives in [`api-server/README.md`](../api-server/README.md). Summary:

| Endpoint | Notes |
| --- | --- |
| `GET /api/content` | filters `type, categoryId, series, featured, demo, search, sort, page, pageSize` |
| `GET /api/content/snapshot` | every record, newest first — the public pages hydrate from this |
| `GET /api/content/counts` | per-type totals for the library tabs |
| `GET /api/content/{type}/{slug}` | `video|book|article|research` (+ plural aliases) |
| `POST/PUT/DELETE /api/content[/{id}]` | editorial writes (JWT) |
| `GET /api/categories` | includes `contentCount` |
| `POST/PUT/DELETE /api/categories/{id}` | admin only for delete-with-content → 409 |
| `POST /api/auth/register`, `POST /api/auth/login` | issue the API's own JWT; first account is admin+editor |
| `GET /api/auth/me` | profile + roles of the token's user |
| `GET /api/users`, `POST /api/users/{id}/roles` | admin only |
| `GET/PUT /api/settings/{id}` | site settings blob |
| `GET/POST/PUT/DELETE /api/debates` | debates archive |
| `GET /health` | anonymous liveness probe |

Errors are RFC 7807 Problem Details everywhere. Writes require `Authorization: Bearer <jwt>`.

## Frontend-owned server routes — `moaz-alian/src/routes/api/`

## `POST /api/chat`

Chat proxy to the AI gateway.

- Optional `AI_API_KEY` / `AI_GATEWAY_URL` server env.

## `GET /api/media/$`

Proxies or serves validated media object paths (rejects `..` and invalid paths).
