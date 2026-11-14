# MOAZ ALIAN Platform | منصة معاذ عليان المعرفية

<div align="center">

![Platform Banner](https://raw.githubusercontent.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/main/apps/dashboard/public/favicon.png)

### منصة معرفية عربية في مقارنة الأديان والقضايا الفكرية
*An advanced Arabic research platform & digital library for comparative religion studies, debates, publications, and multimedia archives.*

[![Node Version](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-12.x-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Backend](https://img.shields.io/badge/Backend-Express_5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![ORM](https://img.shields.io/badge/ORM-Prisma_6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Frontend](https://img.shields.io/badge/Frontend-TanStack_Start_%2B_React_19-FF4154?style=for-the-badge&logo=react&logoColor=white)](https://tanstack.com/start)
[![Styling](https://img.shields.io/badge/Styling-Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Deploy](https://img.shields.io/badge/Deploy-Vercel_Multi--Service-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

---

## Overview

**MOAZ ALIAN Platform** is a full-stack monorepo designed for high performance, server-side rendering (SSR), and editorial content management. It brings together video archives, books, scholarly articles, and debates authored by researcher **Moaz Alian**, accompanied by an editorial management dashboard and conversational AI assistance.

### Key Highlights
- **High Performance API:** Re-engineered backend in Express 5 + TypeScript + Prisma ORM with strict RFC 7807 problem+json error formatting, Pino structured logging, and in-memory read caching.
- **Modern Full-Stack SSR:** Public and Dashboard applications powered by React 19, TanStack Start & Router with type-safe routing, seamless SSR hydration, and RTL-first Arabic typography.
- **Atomic Vercel Deployment:** Single-project multi-service architecture seamlessly orchestrating the public frontend (`/`), dashboard (`/dashboard/*`), and Express API (`/api/*`) with zero cross-origin configuration friction.
- **Shared Code Intelligence:** Centralized design system (`@moaz/ui`), typed HTTP client (`@moaz/api-client`), and core schemas (`@moaz/shared-types`).

---

## Architecture

```mermaid
graph TD
    User([End Users & Scholars]) -->|HTTPS /| Vercel[Vercel Edge Router]
    Staff([Editors & Researchers]) -->|HTTPS /dashboard/*| Vercel

    subgraph "Vercel Multi-Service Project"
        Vercel -->|Rewrite /| PublicApp["apps/public (TanStack Start SSR)"]
        Vercel -->|Rewrite /dashboard/*| DashApp["apps/dashboard (TanStack Start)"]
        Vercel -->|Rewrite /api/*| ApiServer["apps/api (Express 5 + Prisma)"]

        PublicApp -.->|Internal Service Binding API_URL| ApiServer
        DashApp -.->|Internal Service Binding API_URL| ApiServer
    end

    subgraph "Workspace Packages"
        UI["packages/ui (Radix + Tailwind)"] --> PublicApp
        UI --> DashApp
        ApiClient["packages/api-client"] --> PublicApp
        ApiClient --> DashApp
        SharedTypes["packages/shared-types"] --> ApiClient
        SharedTypes --> ApiServer
    end

    subgraph "Data & Cloud"
        ApiServer --> Postgres[(PostgreSQL `library` schema)]
        ApiServer -.-> AI[Lovable / OpenAI API]
    end
```

---

## Monorepo Layout

```
MOAZ-ALIAN-PLATFORM/
├── apps/
│   ├── api/               # Express 5 backend with Prisma ORM & PostgreSQL
│   ├── public/            # Public-facing TanStack Start application (SSR & SEO)
│   └── dashboard/         # Editorial dashboard for content, users & site settings
├── packages/
│   ├── api-client/        # Type-safe client consumed by frontend apps
│   ├── shared-types/      # Core data models and entity definitions
│   └── ui/                # Shared Radix UI + Tailwind CSS component library
├── docs/                  # Architecture, deployment, setup & API guides
├── .github/workflows/     # CI pipeline (typecheck, lint, test, security audit)
├── vercel.json            # Vercel multi-service configuration & edge routing
├── pnpm-workspace.yaml    # Workspace definition & pnpm 12 build allowances
└── package.json           # Workspace root scripts & tooling
```

---

## Quick Start

### 1. Prerequisites
- **Node.js** `>= 22`
- **pnpm** `^12.14.0` (`npm i -g pnpm`)
- **PostgreSQL** 16+ running locally or hosted on Neon/Supabase/RDS

### 2. Installation
Clone the repository and install all dependencies in one command from the workspace root:

```bash
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
pnpm install
```

### 3. Environment Configuration
Copy the API environment template:

```bash
cp apps/api/.env.example apps/api/.env
```

Ensure your `apps/api/.env` contains your database connection string and JWT secret:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/moaz_alian?schema=library
AUTH_JWT_SECRET=super-secret-random-32-characters-minimum
AUTH_ADMIN_EMAILS=["admin@moazalian.com"]
```

### 4. Run Locally

You can launch all services or work on individual applications directly from the root:

| Command | Action | Local URL |
|---|---|---|
| `pnpm dev:api` | Starts the Express API server with live reloading | `http://localhost:5199` |
| `pnpm dev:public` | Starts the Public site | `http://localhost:5173` |
| `pnpm dev:dashboard` | Starts the Editorial Dashboard | `http://localhost:5174` |
| `pnpm build` | Compiles every package across the workspace | — |
| `pnpm test` | Runs the full Vitest automated test suite | — |

---

## Deployment (Vercel Multi-Service)

The entire platform deploys atomically to **Vercel** as a unified project defined in [`vercel.json`](./vercel.json):

| Service | Root Directory | Framework | Public Route |
|---|---|---|---|
| **`public`** | `apps/public` | `tanstack-start-lovable` | `/` |
| **`dashboard`** | `apps/dashboard` | `tanstack-start-lovable` | `/dashboard` & `/dashboard/*` |
| **`api`** | `apps/api` | `express` | `/api/*` |

### Required Environment Variables in Vercel
Set these in **Vercel Dashboard → Project Settings → Environment Variables**:

| Variable | Target Service | Purpose |
|---|---|---|
| `DATABASE_URL` | `api` | Publicly reachable PostgreSQL connection with `?schema=library` |
| `AUTH_JWT_SECRET` | `api` | 32+ character HMAC-SHA256 JWT key |
| `FRONTEND_URL` | `api` | Production domain URL for OAuth redirects |
| `AUTH_ADMIN_EMAILS` | `api` | JSON array of administrative email addresses (e.g. `["admin@example.com"]`) |
| `CORS_ALLOW_VERCEL_ORIGINS`| `api` | Set `true` to allow preview deployments on `*.vercel.app` |

*For complete deployment details and advanced tuning, consult the [Deployment Guide](./docs/DEPLOY.md).*

---

## Documentation

- [Setup & Local Development Guide](./docs/SETUP.md)
- [System Architecture & Data Flows](./docs/ARCHITECTURE.md)
- [Deployment & Vercel Multi-Service](./docs/DEPLOY.md)
- [REST API Reference & OpenAPI](./docs/API.md)
- [Contribution Guidelines](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

---

## License

This project is licensed under the [MIT License](./LICENSE).
