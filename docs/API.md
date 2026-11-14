# API

## Backend — `apps/api/` (Express 5, http://localhost:5199)

Summary of endpoints (full source in `apps/api/src/modules/`):

| Endpoint | Notes |
| --- | --- |
| `GET /api/content` | filters `type, categoryId, series, featured, demo, search, sort, page, pageSize` |
| `GET /api/content/snapshot` | every record, newest first |
| `GET /api/content/counts` | per-type totals for the library tabs |
| `GET /api/content/{type}/{slug}` | `video|book|article|research` |
| `POST/PUT/DELETE /api/content[/{id}]` | editorial writes (JWT) |
| `GET /api/categories` | includes `contentCount` |
| `POST/PUT/DELETE /api/categories/{id}` | admin only for delete-with-content → 409 |
| `POST /api/auth/register`, `POST /api/auth/login` | issue the API's own JWT; admin roles only via `AUTH_ADMIN_EMAILS` |
| `GET /api/auth/me` | profile + roles of the token's user |
| `PUT /api/auth/me` | update profile |
| `POST /api/auth/change-password` | change password (Bearer) |
| `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | reset token stored server-side only, delivered out-of-band |
| `GET /api/users`, `POST /api/users/{id}/roles` | admin only |
| `GET/PUT /api/settings/{id}` | site settings blob |
| `GET/POST/PUT/DELETE /api/debates` | debates archive |
| `GET /health` | anonymous liveness probe |

Errors are RFC 7807 `application/problem+json`. Writes require `Authorization: Bearer <jwt>`.

Auth failures use the `Results.Problem` shape with an `https://httpstatuses.com/<status>` type and `traceId` extension.

## Frontend-owned server routes (per-app `src/routes/api/`)

### `POST /api/chat`

Chat proxy to the AI gateway. See `apps/public/src/routes/api/chat.ts` / `apps/dashboard/src/routes/api/chat.ts`.

### `GET /api/media/$`

Reserved route — currently returns 404.

## OpenAPI

A regenerated OpenAPI 3.0 document is served at `GET /openapi/v1.json` in development (production requires `SWAGGER_ENABLED=true`).
