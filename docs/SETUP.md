# Setup Guide

## Prerequisites

- Node.js 18+
- npm, yarn, or bun
- Git
- Supabase account (free tier available)
- OpenAI API key

## Installation

### 1. Clone Repository

```sh
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
```

### 2. Frontend Setup (moaz-alian/)

```sh
cd moaz-alian
npm install
cp .env.example .env.local
```

**Edit `.env.local`:**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key
```

Start development:
```sh
npm run dev
```

Access at: `http://localhost:5173`

### 3. Backend Setup (api-server/)

```sh
cd api-server
npm install
cp .env.example .env.local
```

**Edit `.env.local`:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/moaz_alian
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret_key
PORT=3000
NODE_ENV=development
```

Start development:
```sh
npm run dev
```

Access at: `http://localhost:3000`

## Environment Configuration

### Frontend Variables (moaz-alian/.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_OPENAI_API_KEY` | Yes | OpenAI API key |
| `VITE_APP_URL` | No | Application base URL |

### Backend Variables (api-server/.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (development/production) |

## Database Setup

### Supabase

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Get credentials from project settings
4. Add to frontend `.env.local`

### Local PostgreSQL

1. Install PostgreSQL
2. Create database:
   ```sh
   createdb moaz_alian
   ```
3. Run migrations:
   ```sh
   cd moaz-alian
   npm run db:migrate
   ```
4. Add connection string to backend `.env.local`:
   ```
   DATABASE_URL=postgresql://localhost/moaz_alian
   ```

## Running Both Applications

**Terminal 1 - Frontend:**
```sh
cd moaz-alian
npm run dev
```

**Terminal 2 - Backend:**
```sh
cd api-server
npm run dev
```

Both will run in development mode with hot reload.

## Build for Production

### Frontend
```sh
cd moaz-alian
npm run build
npm run preview  # Preview production build
```

### Backend
```sh
cd api-server
npm run build
```

## Docker Setup (Optional)

### Frontend
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
```

### Backend
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Code Quality

### All Applications

```sh
npm run lint      # ESLint check
npm run format    # Prettier format
npm run test      # Run tests
```

## Troubleshooting

### Port Already in Use

Change port in app config:
```sh
npm run dev -- --port 3001
```

### Database Connection Error

1. Verify connection string
2. Check PostgreSQL is running
3. Verify user has database access

### Module Not Found

Clear and reinstall:
```sh
rm -rf node_modules package-lock.json
npm install
```

### Environment Variables Not Loaded

For frontend: ensure variable starts with `VITE_`

For backend: restart dev server after changing `.env`

## IDE Setup

### VS Code Extensions

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Thunder Client or REST Client (for API testing)

### Settings (.vscode/settings.json)

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview
- Check [API.md](./API.md) for API documentation
- See [../CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines
