# Architecture Overview

## System Architecture

MOAZ ALIAN Platform is a full-stack application with separate frontend and backend services.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
│  (React 19, TypeScript, Tailwind, Radix UI)                │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP/REST API
┌────────────────▼────────────────────────────────────────────┐
│                  Backend API Server                         │
│  (Node.js, Express/Nitro, TypeScript)                       │
├────────────────────────────────────────────────────────────┤
│  • Authentication & Authorization                           │
│  • Business Logic                                           │
│  • API Endpoints                                            │
│  • Database Queries                                         │
└────────────────┬────────────────────────────────────────────┘
                 │ SQL/ORM Queries
┌────────────────▼────────────────────────────────────────────┐
│              PostgreSQL Database                            │
│  (Supabase or Self-hosted)                                  │
│                                                              │
│  Tables:                                                     │
│  • users, organizations                                     │
│  • library_items, categories                                │
│  • chat_threads, messages                                   │
│  • debates, discussions                                     │
└──────────────────────────────────────────────────────────────┘

External Services:
┌────────────────────────┐    ┌────────────────────────┐
│    Supabase Auth       │    │    OpenAI API          │
│  (JWT, Session Mgmt)   │    │  (AI Assistant)        │
└────────────────────────┘    └────────────────────────┘
```

## Frontend Architecture (moaz-alian/)

### Directory Structure
```
moaz-alian/
├── src/
│   ├── components/          # React components
│   │   ├── ai-elements/    # AI chat UI
│   │   ├── chat/           # Chat features
│   │   ├── dashboard/      # Admin dashboard
│   │   ├── library/        # Knowledge library
│   │   └── ui/             # Radix UI wrappers
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities & helpers
│   ├── pages/              # Page components
│   ├── server/             # Server-side logic
│   │   ├── api/            # API routes
│   │   └── db/             # Database queries
│   └── styles/             # Global styles
├── public/                 # Static assets
└── drizzle/                # Database migrations
```

### Tech Stack
- **Framework**: React 19 + TanStack Start
- **Language**: TypeScript
- **Routing**: TanStack Router
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **State**: TanStack Query + React Context
- **Forms**: React Hook Form + Zod
- **Build**: Vite
- **AI**: Vercel AI SDK

### Data Flow
```
User Action
    ↓
React Component (Event Handler)
    ↓
TanStack Query / API Call
    ↓
TanStack Router (if route change)
    ↓
Component Re-render
```

### Key Components

**ai-elements/**: 
- Conversation UI
- Message display
- Prompt input with streaming support

**chat/**:
- Thread management
- Message history
- Real-time updates

**dashboard/**:
- Admin controls
- User management
- Analytics

## Backend Architecture (api-server/)

### Directory Structure
```
api-server/
├── src/
│   ├── routes/            # API endpoint handlers
│   ├── db/                # Database layer
│   │   ├── queries/       # Query builders
│   │   └── schema/        # Database schema
│   ├── middleware/        # Express middleware
│   ├── services/          # Business logic
│   ├── types/             # TypeScript types
│   └── utils/             # Helpers
├── tests/                 # Test files
└── dist/                  # Compiled output
```

### Tech Stack
- **Runtime**: Node.js
- **Framework**: Express/Nitro
- **Language**: TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Supabase + JWT
- **AI**: OpenAI API
- **Testing**: Vitest

### API Endpoints

**Knowledge Library**
```
GET    /api/library              # List items
GET    /api/library/:id          # Get item
POST   /api/library              # Create item
PUT    /api/library/:id          # Update item
DELETE /api/library/:id          # Delete item
```

**Chat**
```
GET    /api/chats                # List conversations
POST   /api/chats                # Create conversation
GET    /api/chats/:id/messages   # Get messages
POST   /api/chats/:id/messages   # Send message
```

**Users**
```
GET    /api/users/profile        # Current user
PUT    /api/users/profile        # Update profile
POST   /api/auth/logout          # Logout
```

## Database Schema

### Core Tables

**users**
```sql
id UUID PRIMARY KEY
email VARCHAR UNIQUE
name VARCHAR
role VARCHAR (admin, user)
created_at TIMESTAMP
```

**library_items**
```sql
id UUID PRIMARY KEY
title VARCHAR
description TEXT
category_id UUID
type VARCHAR (video, book, article, research)
url TEXT
created_at TIMESTAMP
```

**chat_threads**
```sql
id UUID PRIMARY KEY
user_id UUID
title VARCHAR
created_at TIMESTAMP
```

**chat_messages**
```sql
id UUID PRIMARY KEY
thread_id UUID
user_id UUID
content TEXT
role VARCHAR (user, assistant)
created_at TIMESTAMP
```

See `moaz-alian/drizzle/schema.ts` for complete schema.

## Authentication Flow

```
1. User visits app
2. Check JWT token (localStorage/cookie)
3. If valid, load user session
4. If invalid/expired, redirect to login
5. User enters credentials
6. Backend validates with Supabase
7. Return JWT token
8. Store token locally
9. Include token in API requests
10. Backend verifies token on each request
```

## State Management

### Frontend
- **Server State**: TanStack Query (API data)
- **Client State**: React hooks + Context API
- **Form State**: React Hook Form
- **Navigation**: TanStack Router

### Backend
- **Request-scoped**: Express middleware + locals
- **Cache**: Redis (optional)
- **Database**: PostgreSQL

## Deployment Architecture

### Frontend Deployment
```
GitHub Repo → CI/CD Pipeline → Build (Vite) → Deploy to CDN/Vercel
```

### Backend Deployment
```
GitHub Repo → CI/CD Pipeline → Build → Docker Image → Deploy to Platform
```

### Database
```
Supabase (Managed PostgreSQL) or Self-hosted PostgreSQL
```

## Security

- **Authentication**: JWT tokens
- **Authorization**: Role-based access control
- **API**: CORS, rate limiting
- **Data**: SQL injection prevention via ORM
- **HTTPS**: Required for production
- **Secrets**: Environment variables

## Performance

- **Frontend**: Code splitting, lazy loading
- **Backend**: Indexed database queries, caching
- **Database**: Connection pooling
- **Assets**: WebP images, CDN delivery

## Monitoring & Logging

- **Frontend**: Error tracking (Sentry)
- **Backend**: Structured logging
- **Database**: Query monitoring
- **Infrastructure**: Performance metrics

---

For detailed setup, see [SETUP.md](./SETUP.md)
