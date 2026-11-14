# Quick Start Guide

## 5-Minute Setup

### 1. Clone & Navigate

```bash
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
```

### 2. Backend Setup (Express API)
```bash
cd apps/api
pnpm install
cp .env.example .env
# edit .env — set DATABASE_URL, AUTH_JWT_SECRET
pnpm dev
```
API: http://localhost:5199

### 3. Frontend Setup — Public site
```bash
cd apps/public
pnpm install
pnpm dev
```
Public site: http://localhost:5173

### 4. Frontend Setup — Dashboard
```bash
cd apps/dashboard
pnpm install
pnpm dev
```
Dashboard: http://localhost:5174

## Key Commands

### Backend (apps/api/)
```bash
pnpm dev          # Start dev server (tsx watch)
pnpm build        # tsc compile
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # Vitest unit tests
pnpm db:migrate   # prisma migrate deploy
```

### Frontends (apps/public/, apps/dashboard/)
```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # Check code quality
pnpm format       # Auto-format code
pnpm test         # Run tests
```

## Structure

```
MOAZ-ALIAN-PLATFORM/
├── api/              Backend (Express 5 API)
├── apps/
│   ├── public/       Frontend — public site
│   └── dashboard/    Frontend — admin dashboard
├── packages/         Shared workspace packages
├── docs/             Documentation
├── .github/          GitHub workflows
└── README.md         Overview
```

## Deployment

The repository deploys to **Vercel** via `vercel.json` (multi-service: `api`, `public`, `dashboard`, `ui`).

## Environment Variables

### Frontends (apps/public/.env, apps/dashboard/.env)
```env
VITE_API_URL=http://localhost:5199
API_URL=http://localhost:5199
AI_API_KEY=your_ai_api_key
```

### Backend (apps/api/.env)
```env
DATABASE_URL=postgresql://user:password@host:5432/moaz_alian?schema=library
AUTH_JWT_SECRET=your_32_char_secret
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

## Common Issues

**Port in use?**
```bash
# change PORT in apps/api/.env or pass PORT=5200 pnpm dev
```

## API Documentation

Browse [docs/API.md](./docs/API.md) for complete API reference.
