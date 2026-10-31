# Contributing to MOAZ ALIAN Platform

Thank you for your interest in contributing! We welcome contributions from the community.

## Getting Started

### 1. Fork and Clone

```sh
git clone https://github.com/your-username/MOAZ-ALIAN-PLATFORM.git
cd MOAZ-ALIAN-PLATFORM
```

### 2. Create a Feature Branch

```sh
git checkout -b feature/your-feature-name
```

### 3. Set Up Development Environment

Follow the setup guide in [docs/SETUP.md](./docs/SETUP.md)

## Development Workflow

### Frontend Changes (moaz-alian/)

```sh
cd moaz-alian
npm install
npm run dev
```

### Backend Changes (api-server/)

```sh
cd api-server
npm install
npm run dev
```

## Code Standards

### Linting & Formatting

```sh
npm run lint      # Check for issues
npm run format    # Auto-format code
```

### Commit Convention

- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `style: format code`
- `refactor: restructure code`
- `test: add/update tests`
- `chore: maintenance tasks`

Example:
```sh
git commit -m "feat: add knowledge library search"
```

### Testing

All new features should include tests:

```sh
npm run test          # Run tests once
npm run test:watch    # Run in watch mode
```

## Pull Request Process

1. **Before Creating PR**
   - Pull latest from main: `git pull origin main`
   - Ensure all tests pass: `npm run test`
   - Ensure linting passes: `npm run lint`
   - Format code: `npm run format`

2. **Create Clear PR**
   - Use descriptive title: "Add search functionality to library"
   - Include description of changes
   - Link related issues: `Closes #123`
   - Add any breaking changes clearly

3. **Review Process**
   - Address feedback promptly
   - Re-request review after changes
   - Maintain respectful communication

## Project Structure

### Frontend (moaz-alian/)
```
src/
├── components/        # Reusable React components
├── hooks/             # Custom hooks
├── lib/               # Utilities and helpers
├── pages/             # Page components
├── server/            # Server-side code
└── styles/            # Global styles
```

### Backend (api-server/)
```
src/
├── routes/            # API route handlers
├── db/                # Database queries
├── middleware/        # Express middleware
├── services/          # Business logic
├── types/             # TypeScript types
└── utils/             # Helper functions
```

## Documentation

When adding features, update:
- `README.md` - If it affects users
- `docs/ARCHITECTURE.md` - If it changes system design
- `docs/API.md` - If it adds API endpoints
- `CHANGELOG.md` - For all changes

## Questions?

- Check [docs/](./docs/) for comprehensive guides
- Open a discussion on GitHub
- Review the [roadmap](./docs/ROADMAP.md)
- Look at existing issues and PRs

## Code of Conduct

Be respectful, inclusive, and professional. We don't tolerate harassment or discrimination.

---

Thank you for making MOAZ ALIAN better! 🙏
