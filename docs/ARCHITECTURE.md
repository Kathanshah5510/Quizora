# Architecture

## Overview

Quizora is a Next.js 15 (App Router) full-stack application with a PostgreSQL database.

```
Browser
  ├── /admin/**         Protected admin area (cookie session)
  ├── /exam/[slug]      Public student exam area (token + attempt session)
  └── /api/**           REST API (Postman-testable, future-extractable)

Next.js 15 (App Router + TypeScript)
  ├── Server Components  — admin pages, results, dashboards
  ├── Server Actions     — simple admin mutations (login, create admin)
  ├── Route Handlers     — REST endpoints for exam flow and Postman testing
  └── Client Components  — exam UI, live dashboard, rich editors

Prisma 6 ORM ──► PostgreSQL 16
  Local: Docker Compose
  Production: Neon (managed)

Storage (abstracted)
  Local: ./uploads/  (dev only)
  Production: S3 / Cloudflare R2

AI (abstracted)
  Google Gemini (free tier) — PDF import + AI-assisted text grading

Real-time (Phase 7)
  Server-Sent Events (SSE) — live admin monitoring dashboard
```

## Authentication

- **Admin auth:** iron-session sealed cookies (httpOnly, SameSite=Lax). Sessions last 8 hours.
- **Student exam:** No account. Identity validated against roster/rules at attempt start. A `sessionToken` (UUID) in the DB controls device locking.
- **Session security:** Server reads the session on every admin request; no client-side trust.

## Key design decisions

| Decision | Chosen | Reason |
|---|---|---|
| Framework | Next.js App Router | Server Components reduce client JS; API Routes allow Postman testing |
| Auth | iron-session | Zero-dependency sealed cookies; no OAuth complexity in V1 |
| ORM | Prisma 6 | Type-safe, migration tooling, good DX |
| Real-time | SSE not WebSocket | Vercel-compatible; sufficient for live dashboard at 200 users |
| Timer | Server-authoritative | `expiresAt` stored at attempt creation; client display only |
| AI abstraction | Provider interface | Easy to swap Gemini for another model |

## Security model

The frontend is untrusted for all security decisions. The server enforces:
- Admin authentication on every admin route
- Student identity + eligibility on attempt start
- `sessionToken` on every exam API call
- Attempt expiry (`expiresAt`) on every exam API call
- Answer key never sent during active attempts
- Grading runs server-side after submission only

See [SECURITY.md](SECURITY.md) for full details.
