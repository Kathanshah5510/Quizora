# Database

## Engine

PostgreSQL 16. Managed locally via Docker Compose; managed cloud instance (Neon) for production.

## ORM

Prisma 6 with `prisma.config.ts`. Migrations are committed to `prisma/migrations/`.

## Key schema decisions

### Multiple attempts per student
`ExamAttempt` uses `attemptNumber` (1-based) with `UNIQUE(examId, studentId, attemptNumber)`.  
The configured `exam.attemptsAllowed` limit is enforced in a server-side transaction (not a DB constraint), allowing future configuration changes. The transaction uses `SELECT ... FOR UPDATE` to prevent race conditions.

### Device locking
A `sessionToken` (UUID) is stored on `ExamAttempt`. Only the holder of the current token can save answers. On reconnect, a new token is issued (old one invalidated). All token transfers are logged to `ExamEvent`.

### Idempotent answer saves
`StudentResponse` has `UNIQUE(attemptId, questionId)`. Answer saves are upserts — retrying on network failure is safe.

### Server-authoritative timer
`ExamAttempt.expiresAt` is set at attempt creation (`startedAt + durationMinutes`). Every API call checks `now < expiresAt`. The client timer is display-only.

### Randomization
`ExamAttempt.randomizedQuestionOrder` and `.randomizedOptionOrders` are stored as JSON at attempt creation and never change. Grading always uses canonical `QuestionOption.isCorrect`, never display positions.

## Entities

See `prisma/schema.prisma` for the authoritative schema.

| Entity | Purpose |
|---|---|
| User | Admin / Super Admin accounts |
| Course | Top-level grouping for exams |
| Exam | Exam with all settings |
| Question | Individual question (6 types) |
| QuestionOption | MCQ/MSQ/T-F options |
| StudentRoster | Allowed students per exam |
| ExamAttempt | A student's exam session |
| StudentResponse | Per-question answers (upsert target) |
| ExamEvent | Audit trail: tab switches, reconnects, etc. |
| Result | Final graded result |
| AIGrading | AI grading record + admin review |
| MediaAsset | Uploaded images/files |
| AuditLog | Admin action audit trail |

## Migrations

```bash
# Create a migration after schema changes
npm run db:migrate

# Apply migrations in production (no interactive prompt)
npm run db:migrate:prod
```
