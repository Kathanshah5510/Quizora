# Quizora

A full-stack online exam platform built with Next.js 15. Designed for academic institutions — faculty create and configure exams, students take them with real-time security enforcement, and results are graded automatically with optional AI assistance.

<!-- > Originally built for **IE403 — Machine Learning** at DA-IICT (Dhirubhai Ambani Institute of Information and Communication Technology). -->

---

## Features

### Admin Portal

**Exam Management**
- Create exams with extensive configuration: timer mode, backtracking rules, fullscreen enforcement, question/option randomization, tab violation thresholds, attempts allowed, availability window, and result release mode
- Six question types: MCQ, MSQ (multi-select), True/False, Numerical, Short Text, Image-based
- Per-question marks and negative marks
- Drag-and-drop question reordering
- Import questions from any CSV or PDF — Gemini AI extracts questions, options, and correct answers without requiring a fixed template
- Multiple accepted answers for Short Text questions

**Grading Engine**
- MCQ / True/False / Image-based: exact match with optional negative marking
- MSQ: configurable policy — Strict (all-or-nothing) or Partial (per-option proportional scoring)
- Numerical: configurable tolerance (exam-level default + per-question override)
- Short Text: three modes — Exact (with fuzzy matching via Levenshtein distance), Manual, or AI-Assisted (Gemini evaluates and suggests a score; admin can accept or override)

**Roster & Monitoring**
- Student roster: add individually or bulk-import via CSV; open-exam mode for external students
- Live monitoring dashboard: per-student status, tab violations, and security events in near real-time
- Per-attempt result breakdown with manual grade override and release controls
- RBAC: Super Admin and Admin roles with enforced permission boundaries

### Student Portal

- Exam landing page with course info, duration, timer type, and availability window — no admin configuration exposed
- Name and student ID entry verified against roster
- Fullscreen enforced from question 1 (race condition fixed — no gap before the first question)
- Per-question or whole-quiz countdown timer with auto-submit on expiry; per-question timer auto-advances to next question
- Tab switch detection with violation overlay → auto-submits at configured threshold
- Copy/paste and right-click disabled during exam
- Answers auto-saved on every interaction
- Result page: score, percentage, submission ID (with copy button), and per-question breakdown; correct answers revealed only after the availability window closes in AUTO mode

### UI / UX
- Dark mode toggle across all pages — no flash on load (inline script sets class before React hydrates)
- Password show/hide on all password fields
- Toast notifications for admin actions
- Mobile-responsive admin sidebar with slide-in drawer
- Skeleton loaders for async pages
- Back buttons on all sub-pages

---

## Technical Highlights

**Server-authoritative timer** — `expiresAt` is stored in the database at attempt creation. The client displays a countdown and syncs every 30 seconds, but the server decides when time is up regardless of what the client says.

**Tamper-proof session** — A UUID session token is generated per attempt, stored in `sessionStorage` (never in the URL), and required as an `X-Session-Token` header on every exam API call. Answer keys are never included in API responses during an active attempt.

**Grading as a pure function pipeline** — `gradeQuestion()` is a side-effect-free function that can be unit tested in isolation. `autoGradeAttempt()` is idempotent (upsert) and safe to call multiple times. AI grading is an optional post-pass — if it fails, the question stays pending for manual review without breaking anything else.

**Race-condition-safe attempt creation** — Uses `SELECT FOR UPDATE` inside a transaction to prevent two simultaneous requests from consuming the same attempt slot. Enforced by a unique constraint on `(examId, studentId, attemptNumber)`.

**Fuzzy answer matching** — Levenshtein edit distance with a threshold of `min(3, floor(maxLen × 0.15))` — catches typos and plurals (neurons → neuron) without confusing semantically different words (supervised ≠ unsupervised).

**Conditional answer exposure** — In AUTO result mode, the score is shown immediately after submission but correct answers are withheld until the availability window closes, preventing early finishers from leaking answers to others still in the exam. All gating is computed server-side.

**Audit logging** — Every security event (tab switch, fullscreen exit, reconnect) is written to an `ExamEvent` table with metadata and timestamp, queryable per attempt.

**Soft deletes** — All deletions set `isDeleted: true`. Nothing is hard-deleted, so audit trails remain intact.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) · React 19 · TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL 16 · Prisma 6 |
| Auth | iron-session 8 · bcrypt |
| Validation | Zod 3 |
| AI | Google Gemini 2.5 Flash |
| Notifications | sonner |
| Testing | Vitest 3 |
| Dev database | Docker Compose |

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker Desktop (running)
- Git

### 1. Clone and install
```bash
git clone https://github.com/Kathanshah5510/Quizora.git
cd Quizora
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
```

Minimum `.env.local` for local dev:
```
DATABASE_URL=postgresql://quizora:changeme@localhost:5432/quizora
POSTGRES_PASSWORD=changeme
SESSION_SECRET=<at-least-32-random-chars>
GEMINI_API_KEY=<your-gemini-api-key>
```

Generate a session secret:
```bash
openssl rand -base64 32
```

Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com). Required for AI question import and AI-assisted grading.

### 3. Start PostgreSQL
```bash
docker compose -f docker/docker-compose.yml up -d
```

### 4. Run migrations and seed
```bash
npm run db:migrate
npm run db:seed
```

### 5. Start development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
Admin portal: [http://localhost:3000/admin](http://localhost:3000/admin)

**Default seed credentials — change after first login:**

| Account | Email | Password |
|---|---|---|
| Super Admin | `superadmin@quizora.local` | `SuperAdmin@123` |
| Admin | `admin@quizora.local` | `Admin@123456` |

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm run test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |

---

## Project Structure

```
app/
  (auth)/         Login / logout
  admin/          Protected admin area (exams, questions, roster, monitor, results)
  exam/           Student-facing pages (landing, start, attempt, result)
  api/            REST API route handlers
components/
  admin/          Admin UI components (forms, sidebar, monitor client)
  exam/           Student exam components (useExamGuard hook)
  ThemeToggle.tsx Dark mode toggle
  PasswordInput.tsx Password field with show/hide
  CopyButton.tsx  Clipboard copy with confirmation
lib/
  auth.ts         Admin session (iron-session)
  db.ts           Prisma client singleton
  grading/        Pure grading engine (gradeQuestion, gradeAttempt, autoGradeAttempt)
  ai/             Gemini integration (question extraction, text grading)
  exam/           Timer utilities, rate limiting, access control
  results/        Result domain logic (visibility rules, summary builder)
  validation/     Zod schemas for all forms and API inputs
prisma/
  schema.prisma   Full database schema
  migrations/     Migration history
  seed.ts         Dev seed data
docker/
  docker-compose.yml  Local PostgreSQL
tests/
  unit/           Vitest unit tests
  e2e/            Playwright E2E tests
docs/             Architecture, security, deployment, scaling docs
```

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Security](docs/SECURITY.md)
- [Scaling](docs/SCALING.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)
