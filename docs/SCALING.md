# Scaling

## Current target: 200 concurrent students

V1 is designed for 200 concurrent students in a single exam. The main bottleneck is autosave (one upsert per student every ~30 s = ~7 writes/s), which PostgreSQL handles easily.

## Phase 1–2: 200 concurrent (current)

- Next.js on Vercel (serverless functions)
- Neon PostgreSQL with built-in PgBouncer (connection pooling)
- Server-Sent Events for live dashboard
- Local file storage → S3/R2 for media

No changes needed at this scale.

## Phase 2: 200 → 500 concurrent

- Enable Prisma Accelerate or configure PgBouncer pool size
- Add `DATABASE_URL` with pooling URL from Neon
- Increase Vercel function concurrency limits
- Add caching (Next.js `unstable_cache` or Redis) for read-heavy admin pages

## Phase 3: 500 → 1000+ concurrent

### Connection pooling
- Migrate to dedicated PgBouncer or Neon's connection pooling at `?pool_timeout=0`
- Consider Prisma Accelerate for global edge caching

### Service extraction (Prisma → FastAPI + SQLAlchemy)
When exam throughput exceeds serverless function limits:
1. Extract the exam attempt API (`/api/exam/**`) into a standalone **FastAPI service** (Python + SQLAlchemy + asyncpg)
2. FastAPI handles long-lived connections naturally (async I/O)
3. SQLAlchemy with `asyncpg` driver for async PostgreSQL
4. Next.js becomes the frontend + admin service; FastAPI handles the hot path
5. Shared PostgreSQL instance initially → read replicas later

Migration path:
```
Now:       Next.js → Prisma → PostgreSQL
Next:      Next.js (admin) + FastAPI (exam) → PostgreSQL
Later:     Next.js (admin) + FastAPI (exam) → PostgreSQL (primary + read replica)
```

### Caching
- Redis (Upstash or Railway) for:
  - Active exam metadata (TTL = exam duration)
  - Attempt status lookups
  - Roster lookups
- CDN (Cloudflare) for media assets

### WebSockets for live dashboard
Replace SSE with WebSocket server (e.g. Ably, Pusher, or self-hosted Socket.io) when dashboard needs >100 simultaneous admin viewers.

### Queues
- Background jobs (AI grading, result release, export generation) → BullMQ (Redis-backed) or Inngest
- Auto-submission of expired attempts → scheduled job every 60 s

### Horizontal scaling
- Vercel auto-scales functions; no change needed
- FastAPI: deploy on Railway, Fly.io, or AWS ECS with 2–4 replicas
- PostgreSQL: enable read replicas on Neon (or migrate to RDS)

### Load testing
Before any real exam:
- `k6` or `Locust` for API load tests
- Simulate 200 concurrent students: identity validation → start → 60× answer save → submit
- Target: p99 < 500 ms for answer save endpoint

## Multi-course / multi-batch (V2)

- Add `Batch` entity between `Course` and `StudentRoster`
- Tag questions with topics/difficulty for a global question bank
- Add per-batch scheduling and result isolation

## Global question bank (V2)

Currently each exam has its own question set (no shared bank). V2 adds:
- `QuestionBank` entity (global, tagged)
- Exam references question bank items
- Requires deduplication strategy for randomization
