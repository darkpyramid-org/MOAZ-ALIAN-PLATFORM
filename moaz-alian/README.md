# MOAZ ALIAN

MOAZ ALIAN is a cultural library and research platform for publishing and exploring books, articles, videos, research, debates, and authenticated editorial content.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

## Validation

```sh
bun run lint
bun run format:check
bun run test
bun run build
```

Database migrations are managed with Drizzle under `drizzle/migrations`. Configure the migration database URL with `LOVABLE_DB_MIGRATION_URL` before applying migrations. Public signup never grants an administrative role; bootstrap administrators through a controlled service-role operation.
