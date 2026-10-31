# MOAZ ALIAN Platform

مساحة معرفية عربية للبحث والقراءة: فيديوهات، كتب، مقالات وأبحاث، مع لوحة تحكم للفريق ومساعد ذكي.

A comprehensive Arabic knowledge platform with video, book, article, and research content, featuring team dashboard and intelligent assistant.

## Repository Structure

```
.
├── moaz-alian/          # Frontend application (React + TanStack)
├── api-server/          # Backend API server (Node.js)
├── docs/                # Shared documentation
├── .github/             # GitHub workflows and templates
├── README.md            # This file
├── CHANGELOG.md         # Version history
├── CONTRIBUTING.md      # Contribution guidelines
└── LICENSE              # MIT License
```

## Quick Start

### Frontend (moaz-alian)

```sh
cd moaz-alian
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

### Backend (api-server)

```sh
cd api-server
npm install
npm run dev
```

Backend runs at: `http://localhost:3000`

## Tech Stack

### Frontend
- React 19 with TypeScript
- TanStack Start & Router
- Tailwind CSS + Radix UI
- Vite build tool
- Vercel AI SDK

### Backend
- Node.js with Express/Nitro
- PostgreSQL (Supabase)
- Drizzle ORM
- Authentication (Lovable Cloud Auth)

## Documentation

- [Setup Guide](./docs/SETUP.md) - Installation and configuration
- [Architecture](./docs/ARCHITECTURE.md) - System design overview
- [API Documentation](./docs/API.md) - API endpoints and usage
- [Contributing](./CONTRIBUTING.md) - How to contribute
- [Roadmap](./docs/ROADMAP.md) - Future plans

## Development

### Prerequisites
- Node.js 18+
- npm/yarn/bun
- Git

### Environment Setup

Create `.env.local` files in both `moaz-alian/` and `api-server/`:

**moaz-alian/.env.local:**
```env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
VITE_OPENAI_API_KEY=your_key
```

**api-server/.env.local:**
```env
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_key
JWT_SECRET=your_secret
```

### Running Both Apps

Terminal 1 (Frontend):
```sh
cd moaz-alian
npm run dev
```

Terminal 2 (Backend):
```sh
cd api-server
npm run dev
```

## Code Quality

### Frontend
```sh
cd moaz-alian
npm run lint      # Check linting
npm run format    # Format code
npm run test      # Run tests
```

### Backend
```sh
cd api-server
npm run lint      # Check linting
npm run format    # Format code
npm run test      # Run tests
```

## Building

### Frontend
```sh
cd moaz-alian
npm run build     # Production build
npm run preview   # Preview build
```

### Backend
```sh
cd api-server
npm run build     # Production build
```

## Deployment

- **Frontend**: Vercel, Netlify, Cloudflare Pages
- **Backend**: Vercel, Railway, Heroku, AWS Lambda
- **Database**: Supabase (managed PostgreSQL)

See [SETUP.md](./docs/SETUP.md) for detailed deployment instructions.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.

## Support

- 📚 [Documentation](./docs/)
- 🐛 [Report Issues](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/issues)
- 💬 [Discussions](https://github.com/darkpyramid-org/MOAZ-ALIAN-PLATFORM/discussions)

---

Built with ❤️ by the MOAZ ALIAN team
