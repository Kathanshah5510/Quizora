# Security

## Threat model

Quizora is an exam platform used by students who may attempt to cheat. The frontend is treated as untrusted. All security decisions are server-enforced.

## Authentication (Admin)

- Passwords hashed with bcrypt (cost 12)
- Sessions sealed with iron-session (AES-256-CBC + HMAC-SHA-256)
- Session cookie: httpOnly, SameSite=Lax, Secure in production
- Session TTL: 8 hours
- No JWT stored in localStorage
- Super Admin required to create other admins

## Student identity

- 9-digit student ID required
- Email must be `{studentId}@dau.ac.in`; validated server-side
- Roster check (if `allowExternalStudents = false`)
- Attempt creation inside a `SELECT FOR UPDATE` transaction to prevent race conditions

## Exam security

| Protection | Implementation |
|---|---|
| Answer key | Never sent to client during active attempts |
| Timer | `expiresAt` stored server-side at attempt creation; client display only |
| Randomization | Stored server-side in `ExamAttempt`; grading uses canonical correct answers |
| Device lock | `sessionToken` (UUID); only current holder can save; all transfers logged |
| Auto-submit | Every answer save checks `now < expiresAt`; expired → auto-submit |
| Duplicate attempts | `UNIQUE(examId, studentId, attemptNumber)` + application-side `attemptsAllowed` check |
| Simultaneous devices | New reconnect issues new token; old device gets 401 on next request |

## API security

- Admin routes: session checked server-side on every request
- Exam routes: `sessionToken` validated on every answer save, heartbeat, submit
- Rate limiting: to be implemented in Phase 8 (next.js middleware + Upstash Redis)
- CSRF: Server Actions use Next.js built-in CSRF protection; API routes use SameSite cookies
- Input validation: Zod on all inputs at API boundaries
- SQL injection: prevented by Prisma parameterized queries
- XSS: React escapes output; Content-Security-Policy header to be added in Phase 8
- Upload validation: MIME type + size checks on all file uploads

## Anti-cheating (browser-level)

These are deterrents only. They are not cryptographically enforced.

| Measure | Implementation |
|---|---|
| Tab/visibility detection | `visibilitychange` event → server-logged `TAB_SWITCHED` event |
| 2-violation auto-submit | Server increments `tabViolations`; at 2 → auto-submit |
| Full screen | Optional; enforced client-side only |
| Copy/paste prevention | CSS `user-select: none` + JS event cancellation |
| Right-click | `contextmenu` event cancelled |
| Refresh/reopen | Detected on reconnect; logged as `REFRESHED` event |

**Limitations:** All browser-side anti-cheating can be bypassed by a determined user with browser devtools. These measures deter casual cheating and create an audit trail, but do not prevent a technical user from cheating.

## Secrets management

- Never commit `.env` or `.env.local`
- `SESSION_SECRET` must be ≥ 32 characters (random)
- `GEMINI_API_KEY` and storage credentials stored in environment variables only
- Postman collection uses `{{baseUrl}}` variables; no real credentials committed

## Production checklist

- [ ] `SESSION_SECRET` is random, ≥ 32 chars, not the placeholder
- [ ] `DATABASE_URL` uses TLS (`?sslmode=require` on Neon)
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Cookie `Secure` flag active (enforced when `NODE_ENV=production`)
- [ ] Rate limiting configured
- [ ] CSP headers configured
- [ ] Audit log review process in place
