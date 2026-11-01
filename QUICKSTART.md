# Quick Start Guide

## 5-Minute Setup

### 1. Clone & Navigate
```bash
git clone https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
```

### 2. Frontend Setup
```bash
cd moaz-alian
npm install
cp .env.example .env.local  # Add your credentials
npm run dev
```
👉 Frontend: http://localhost:5173

### 3. Backend Setup (New Terminal)
```bash
cd api-server
npm install
cp .env.example .env.local  # Add your credentials
npm run dev
```
👉 Backend: http://localhost:3000

## Key Commands

### Frontend (moaz-alian/)
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Check code quality
npm run format       # Auto-format code
npm run test         # Run tests
```

### Backend (api-server/)
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Check code quality
npm run test         # Run tests
```

## Structure

```
MOAZ-ALIAN-PLATFORM/
├── moaz-alian/       👈 Frontend (React + TanStack)
├── api-server/       👈 Backend (Node.js API)
├── docs/             👈 Documentation
├── .github/          👈 GitHub workflows
├── README.md         👈 Overview
└── CHANGELOG.md      👈 Version history
```

## Next Steps

1. **Read** [README.md](./README.md) for full overview
2. **Setup** [docs/SETUP.md](./docs/SETUP.md) for detailed configuration
3. **Understand** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design
4. **Contribute** [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines

## Environment Variables

### Frontend (moaz-alian/.env)
```env
VITE_API_URL=http://localhost:5199
API_URL=http://localhost:5199
# AI_API_KEY=your_ai_api_key
```

### Backend (api-server/src/ApiServer.WebApi/appsettings.Development.json or user-secrets)
```json
{
  "ConnectionStrings": {
    "Postgres": "Server=...;Database=...;User Id=...;Password=...;SSL Mode=Require;Trust Server Certificate=true"
  },
  "Auth": { "Issuer": "http://localhost:5199", "JwtSecret": "your_secret_key" }
}
```

## Common Issues

**Port 5173/3000 in use?**
```bash
npm run dev -- --port 3001
```

**Missing dependencies?**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Database connection error?**
- Verify DATABASE_URL is correct
- Ensure PostgreSQL is running

## API Documentation

Browse [docs/API.md](./docs/API.md) for complete API reference.

## Need Help?

- 📖 [Documentation](./docs/)
- 🐛 [Report Issues](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues)
- 💬 [Discussions](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/discussions)

---

Ready to develop? Start with [docs/SETUP.md](./docs/SETUP.md) 🚀
