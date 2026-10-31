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

### Frontend (.env.local)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key
```

### Backend (.env.local)
```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_secret_key
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
