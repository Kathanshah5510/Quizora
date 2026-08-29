# Testing

## Framework

- **Unit / integration:** Vitest 3
- **E2E:** Playwright (Phase 8)

## Running tests

```bash
npm run test          # run all unit tests
npm run test:watch    # watch mode
npm run test:e2e      # Playwright E2E (requires running server)
```

## Test coverage targets

### Identity validation (Phase 1 — implemented)
- [x] Valid 9-digit student ID accepted
- [x] Non-9-digit ID rejected
- [x] Wrong email domain rejected
- [x] Email not matching student ID rejected
- [x] Admin password strength rules

### Attempts (Phase 4)
- [x] First attempt created correctly (`testingMdGapFill.test.ts`)
- [x] `attemptsAllowed=1`: second attempt blocked (`testingMdGapFill.test.ts`)
- [x] `attemptsAllowed=2`: second attempt allowed, third blocked (`testingMdGapFill.test.ts`)
- [x] Simultaneous start race condition: only one attempt created (`submissionRace.test.ts`)
- [x] Reconnect: device-lock and grace-period logic (`reconnect.test.ts`)
- [x] Expired attempt: terminal status blocks new attempt (`testingMdGapFill.test.ts`)

### Randomization (Phase 4)
- [x] Questions appear in randomized order (when enabled) (`randomize.test.ts`)
- [x] Options appear in randomized order (when enabled) (`randomize.test.ts`)
- [x] Grading uses canonical `isCorrect`, not display order (`testingMdGapFill.test.ts`)
- [x] Randomized order is identical on reconnect (stored, not re-generated) (`testingMdGapFill.test.ts`)

### Timer (Phase 4)
- [x] `expiresAt` = `startedAt + durationMinutes` (`testingMdGapFill.test.ts`)
- [x] Answer save after expiry → auto-submit response (`testingMdGapFill.test.ts`)
- [x] Heartbeat after expiry → auto-submit response (`testingMdGapFill.test.ts`)
- [x] Client-manipulated time cannot extend server expiry (`testingMdGapFill.test.ts`)

### Anti-cheating events (Phase 5)
- [x] TAB_SWITCHED event is a violation event (`tabViolation.test.ts`)
- [x] tabViolations counter incremented correctly (`tabViolation.test.ts`)
- [x] At 2 violations: auto-submit triggered (`tabViolation.test.ts`)
- [x] RECONNECTED: reconnect decision logic (device-lock, grace period) (`reconnect.test.ts`)

### Grading (Phase 6)
- [x] MCQ: exact match → full marks (`grading.test.ts`)
- [x] MCQ: wrong answer → negative marks applied (`grading.test.ts`)
- [x] MSQ strict: partial selection → 0 marks (`grading.test.ts`)
- [x] MSQ partial: partial credit applied per policy (`grading.test.ts`)
- [x] Numerical: within tolerance → full marks (`grading.test.ts`)
- [x] Numerical: outside tolerance → 0 marks (`grading.test.ts`)
- [x] TRUE_FALSE: correct → full marks (`grading.test.ts`)
- [x] Text EXACT: case-insensitive match (`grading.test.ts`)
- [x] AI grading: result not released until admin approves (`testingMdGapFill.test.ts`, `aiGradingEndpoint.test.ts`)

### Results (Phase 6)
- [x] Result not accessible before release (`resultRelease.test.ts`)
- [x] AUTO release: visible when grading COMPLETE (`resultRelease.test.ts`)
- [x] MANUAL release: result available only after admin action (`resultRelease.test.ts`)
- [x] Correct answers not leaked in active-exam API responses (`testingMdGapFill.test.ts`)

### Reliability (Phase 8)
- [x] Duplicate answer save (same questionId, same attemptId): idempotent upsert (`testingMdGapFill.test.ts`)
- [x] Duplicate submit: idempotent (second submit returns same submissionId) (`submissionRace.test.ts`)
- [x] Concurrent answer saves: independent rows, no cross-question deadlock (`testingMdGapFill.test.ts`)

### Security (Phase 8)
- [x] Content-Security-Policy header includes all required directives (`cspAndLoginRateLimit.test.ts`)
- [x] Admin login IP rate limiting (`cspAndLoginRateLimit.test.ts`)
- [x] Admin login per-email rate limiting (`cspAndLoginRateLimit.test.ts`)
- [x] Admin password change: current password verified (`passwordChange.test.ts`)
- [x] Admin password change: new password must differ from current (`passwordChange.test.ts`)
- [x] Admin password change: ChangePasswordSchema validation (`passwordChange.test.ts`)

### Admin management (Phase 8)
- [x] Delete admin: cannot delete self (`deleteAdmin.test.ts`)
- [x] Delete admin: cannot delete last super admin (`deleteAdmin.test.ts`)
- [x] Delete admin: blocked when admin owns courses or exams (`deleteAdmin.test.ts`)
- [x] Delete admin: allowed when no content owned (`deleteAdmin.test.ts`)

## E2E test scenarios (Playwright)

All 6 tests run against the live dev server (`npm run test:e2e`). Global setup seeds a
PUBLISHED exam (`e2e-quiz-alpha-001`) with 1 MCQ question and 5 roster students;
global teardown deletes all fixtures in FK-safe order.

**Admin flow** (`tests/e2e/admin-flow.spec.ts`):
1. `scenario 1: admin login` — navigates to /login, fills credentials, asserts redirect to /admin/dashboard
2. `scenario 1: admin creates exam, publishes, closes (full lifecycle)` — creates DRAFT exam via /admin/exams/new, clicks Publish (exact match to avoid "Unpublish" false match), waits for Publish button to disappear then Close Exam to appear, clicks Close Exam, asserts Reopen button appears

**Student flow** (`tests/e2e/student-flow.spec.ts`):
3. `scenario 2: student starts exam, answers, submits, sees confirmation` — fills identity form via React native-value-setter + input event, answers MCQ via `button[aria-pressed]` inside `ul[aria-label="Answer options"]`, submits, asserts inline `h1 "Exam Submitted"` on the same URL
4. `scenario 3: student reconnects after accidental closure — attempt resumes` — starts attempt, reloads page, asserts MCQ option buttons still visible (attempt resumes from sessionStorage token)
5. `scenario 4: duplicate submit returns the same submission ID` — submits twice to `/api/exam/:slug/submit` with `{attemptId, sessionToken}`, asserts second call returns 200 with the same `submissionId`
6. `scenario 5: second device within grace period gets 409 DEVICE_LOCKED` — first context holds active attempt; second context navigates to start URL then POSTs to `/api/exam/:slug/start` without a `resumeToken`, asserts 409 with `code: "DEVICE_LOCKED"`
