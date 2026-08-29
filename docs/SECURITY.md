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
- Admins can change their own password (current password verified before update)
- Super Admins can deactivate or delete admin accounts (with safety guards)

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
- Rate limiting: in-process sliding-window (adapter-based; swap for Redis/Upstash at scale)
  - Student exam start: 600/min per IP, 5/min per student per exam
  - Answer save: 30/min per attempt
  - Event logging: 20/min per attempt
  - Navigation: 60/min per attempt
  - Timer poll: 10/min per attempt
  - Validate identity: 10/min per IP per exam
  - **Admin login: 10/15 min per IP, 5/15 min per email** (brute-force protection)
- CSRF: Server Actions use Next.js built-in CSRF protection; API routes use SameSite cookies
- Input validation: Zod on all inputs at API boundaries
- SQL injection: prevented by Prisma parameterized queries
- XSS: React escapes output; Content-Security-Policy header implemented
- Upload validation: MIME type + size checks on all file uploads

## HTTP security headers

All routes receive these headers (set in `next.config.ts`):

| Header | Value | Purpose |
|---|---|---|
| Content-Security-Policy | See below | Restrict resource loading |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | DENY | Block clickjacking |
| Referrer-Policy | strict-origin-when-cross-origin | Limit referrer leakage |
| Permissions-Policy | camera=(), microphone=(), geolocation=() | Deny sensor APIs |
| X-XSS-Protection | 1; mode=block | Legacy XSS protection |

### Content-Security-Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' data: blob:;
connect-src 'self';
media-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

**Why `'unsafe-inline'` for script-src:** Next.js App Router injects inline scripts
for client-side hydration. Removing `'unsafe-inline'` requires per-request nonce
infrastructure in Next.js middleware — a Phase 9 hardening opportunity.
Despite this, the CSP meaningfully blocks all external script sources, cross-origin
connections, plugins, base-tag injection, and form hijacking.

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
- [x] Rate limiting configured (in-process; swap to Redis/Upstash for multi-instance)
- [x] CSP headers configured
- [ ] Audit log review process in place
- [ ] Default seed passwords changed on first login
