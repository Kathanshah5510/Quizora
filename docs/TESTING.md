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
- [ ] First attempt created correctly
- [ ] `attemptsAllowed=1`: second attempt blocked
- [ ] `attemptsAllowed=2`: second attempt allowed, third blocked
- [ ] Simultaneous start race condition: only one attempt created
- [ ] Reconnect: new sessionToken issued, old rejected on next call
- [ ] Expired attempt: auto-submitted, new attempt not allowed

### Randomization (Phase 4)
- [ ] Questions appear in randomized order (when enabled)
- [ ] Options appear in randomized order (when enabled)
- [ ] Grading uses canonical `isCorrect`, not display order
- [ ] Randomized order is identical on reconnect (stored, not re-generated)

### Timer (Phase 4)
- [ ] `expiresAt` = `startedAt + durationMinutes`
- [ ] Answer save after expiry → auto-submit response
- [ ] Heartbeat after expiry → auto-submit response
- [ ] Client-manipulated time cannot extend server expiry

### Anti-cheating events (Phase 5)
- [ ] TAB_SWITCHED event logged on visibility change
- [ ] tabViolations counter incremented correctly
- [ ] At 2 violations: auto-submit triggered
- [ ] RECONNECTED event logged on reconnect

### Grading (Phase 6)
- [ ] MCQ: exact match → full marks
- [ ] MCQ: wrong answer → negative marks applied
- [ ] MSQ strict: partial selection → 0 marks
- [ ] MSQ partial: partial credit applied per policy
- [ ] Numerical: within tolerance → full marks
- [ ] Numerical: outside tolerance → 0 marks
- [ ] TRUE_FALSE: correct → full marks
- [ ] Text EXACT: case-insensitive match (configurable)
- [ ] AI grading: result stored, not released until admin approves

### Results (Phase 6)
- [ ] Result not accessible before release
- [ ] AUTO release: result available after `availabilityEnd`
- [ ] MANUAL release: result available only after admin action
- [ ] Correct answers not leaked in active-exam API responses

### Reliability (Phase 8)
- [ ] Duplicate answer save (same questionId, same attemptId): idempotent upsert
- [ ] Duplicate submit: idempotent (second submit returns same submissionId)
- [ ] 200 concurrent answer saves: no deadlocks, all succeed

## E2E test scenarios (Playwright)

Phase 8 will implement full Playwright tests for:
1. Admin logs in → creates exam → publishes → closes
2. Student navigates to exam URL → enters identity → starts → answers → submits → sees confirmation
3. Student tries to reconnect after accidental closure → resumes correctly
4. Student tries to submit again → idempotent
5. Student opens exam on second device → first device gets 401
