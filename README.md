# Quizora

Generic online quiz and exam platform. Currently deployed for **IE403 — Machine Learning** at DA-IICT.

## Quick Start (local dev)

### Prerequisites
- Node.js 20+
- Docker Desktop (running)
- Git

### 1. Clone and install
```bash
git clone <repo-url>
cd quizora
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, SESSION_SECRET, and any others you need
```

Minimum `.env.local` for local dev:
```
DATABASE_URL=postgresql://quizora:changeme@localhost:5432/quizora
POSTGRES_PASSWORD=changeme
SESSION_SECRET=<at-least-32-random-chars>   # openssl rand -base64 32
```

### 3. Start PostgreSQL
```bash
# From repo root
docker compose -f docker/docker-compose.yml up -d
```

### 4. Run migrations and seed
```bash
npm run db:migrate     # applies all migrations
npm run db:seed        # creates default super admin + sample data
```

### 5. Start development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).  
Admin portal: [http://localhost:3000/admin](http://localhost:3000/admin)

**Default seed credentials (change after first login):**
| Account | Email | Password |
|---|---|---|
| Super Admin | `superadmin@quizora.local` | `SuperAdmin@123` |
| Admin | `admin@quizora.local` | `Admin@123456` |

## Useful commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |

## Project structure

```
app/            Next.js App Router pages and API routes
  (auth)/       Login / logout (no admin layout)
  admin/        Protected admin area
  exam/         Student-facing exam pages (Phase 4)
  api/          REST API route handlers
components/
  admin/        Admin UI components
  exam/         Student exam UI components (Phase 4)
lib/
  auth.ts       Admin session management (iron-session)
  db.ts         Prisma client singleton
  validation/   Zod schemas
  grading/      Grading engine (Phase 6)
  ai/           AI provider abstraction (Phase 3)
  storage/      File storage abstraction
prisma/
  schema.prisma Full database schema
  migrations/   Migration history
  seed.ts       Dev seed data
docker/
  docker-compose.yml  Local PostgreSQL
tests/
  unit/         Vitest unit tests
  e2e/          Playwright E2E tests (Phase 8)
postman/        Postman collection
docs/           Architecture, security, deployment docs
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Scaling](docs/SCALING.md)
- [Security](docs/SECURITY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)

## Tech stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 16 · Prisma 6 · Zod · iron-session · Vitest · Playwright
