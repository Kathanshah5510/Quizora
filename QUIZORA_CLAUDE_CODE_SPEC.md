# Quizora — Claude Code Build Specification

**Project name:** Quizora  
**Purpose:** Generic online quiz/exam platform, initially for IE403 — Machine Learning.

## Role
Act as lead full-stack architect/engineer. Build incrementally and production-minded.

Workflow: inspect repo/environment → propose architecture + plan → WAIT for approval → implement small milestones → test → security/reliability review → prepare GitHub → ask before deployment/credentials.

Do not make destructive changes, push, or deploy without approval.

## 0. Local development/tooling

The developer currently has these tools installed:
- **Claude Code** — primary coding agent.
- **Google Antigravity** — optional agentic IDE/browser/testing workflow.
- **Docker Desktop** — local PostgreSQL and reproducible local services.
- **Postman** — API development/testing.

### Tooling rules
- Prefer Docker Compose for local PostgreSQL so the development database is reproducible.
- Do not make Docker a production dependency unless explicitly chosen later.
- Keep database configuration in environment variables.
- Maintain a Postman collection for important APIs and update it as APIs change.
- Never put production secrets in committed Docker Compose/Postman files.
- Use Claude Code as the primary implementation agent unless explicitly changed.
- Antigravity may be used for browser-based UI verification, visual iteration, debugging, and parallel agent work; it is not a Quizora runtime dependency.
- If Claude Code and Antigravity both modify the same workspace, avoid simultaneous edits to the same files; use an isolated Git worktree/branch when parallel work is necessary.

## 1. Product
Build a generic reusable online quiz/exam platform.

Current use:
- IE403 — Machine Learning
- Instructor: Prof. Arunava Chakravarty
- Admins: professor + TAs, same permissions for now
- Students: no login
- Initial target: 200 concurrent students
- Public internet deployment
- Future: multiple courses/labs/batches and larger scale

## 2. Roles
### Super Admin
Manage admins and platform settings; full access.

### Admin
Create/edit/delete courses/exams/questions; import questions; schedule/publish/close exams; manage roster; monitor attempts; view/export analytics; grade text; release results.

### Student
No account/login. Uses unique exam URL, enters name + 9-digit student ID + email, one attempt per exam.

## 3. Student identity
- Student ID exactly 9 digits.
- Email must exactly be `{student_id}@dau.ac.in`.
- Roll number and email/student ID must match.
- Exam setting: `Allow external students`, OFF by default.
- If OFF: student must be in uploaded roster.
- If ON: any student satisfying ID/email validation may attempt.
- Roster import: student_id, name, email.
- Prevent duplicate attempts server-side.

## 4. Exam settings
Each exam has its own question set; no global question bank in V1.

Fields/settings:
- Course, title, description, instructor, TA names
- Unique public exam URL/token
- Availability start/end
- Duration
- Timer mode: whole quiz OR per-question
- Per-question duration if selected
- Attempts allowed: default 1, editable
- Randomize questions ON/OFF
- Randomize options ON/OFF
- Backtracking ON/OFF
- Marks/question default 1
- Negative marks default 0
- MSQ grading policy
- Numerical tolerance
- Text grading mode
- Allow external students OFF by default
- Continue-after-availability setting
- Full-screen setting
- Result release: automatic after availability OR manual
- Active/closed state
- Preview exact randomized student experience

Availability controls START time. A student who starts during the window gets the configured duration. Provide an admin setting for alternative behavior if desired.

Timer expiry = automatic submission with all saved answers.

## 5. Student exam flow
1. Open unique URL.
2. See exam instructions.
3. Enter name, 9-digit ID, email.
4. Validate identity/eligibility.
5. Check active attempt/device.
6. Show warnings.
7. Optional full-screen.
8. Start Exam → timer begins.
9. One question/page.
10. Save answers server-side.
11. Navigation depends on backtracking.
12. Manual/automatic submission.
13. Submission confirmation + unique submission ID.
14. Results according to release policy.

Answers are optional.

Backtracking ON: Previous + question navigator/jumping.
Backtracking OFF: forward only, no previous/jumping.

## 6. Question types
V1:
- Single-correct MCQ
- MSQ
- True/False
- Short text
- Numerical
- Image-based

Support images, equations, tables, code snippets.

Question fields: type, text, media/assets, options, correct answer(s), marks, negative marks, tolerance/grading configuration.

## 7. Grading
MCQ: exact answer, marks/negative-mark rules.
MSQ: admin-configurable; default strict exact-set matching.
True/False: exact.
Numerical: configurable tolerance, e.g. 0.532 ± 0.001.
Text: exact matching, manual grading, and AI-assisted grading.

AI grading must have admin-review/final-approval path. Store student answer, AI evaluation, metadata as appropriate, and final approved mark.

## 8. Import
Support manual creation, CSV/Excel, and PDF/document AI extraction.

AI should attempt to extract question/type/options/correct answers/marks/negative marks/images/equations/tables/code. Always show admin review/edit before questions enter an exam.

Use a free API/model where practical. Keep provider abstraction. Before implementation, inspect currently available free options and choose a practical one. Do not hard-code unnecessary provider-specific logic.

## 9. Anti-cheating
Practical deterrents only; do not claim they are foolproof.

- Prevent copy/paste
- Prevent right-click
- Optional full-screen
- Record `visibilitychange`
- Record tab/window visibility events
- Record refresh/reload/reopen
- Detect/reject simultaneous active attempts on another device/browser
- Server-side attempt locking

On visibility loss:
1. Record event.
2. Warn student that tab switching was recorded.
3. After 2 tab-switch violations, auto-submit.

Closing/reopening: record it; allow valid same-attempt resume after accidental closure.

Never trust frontend for timer, answers, scoring, attempt locking, availability, or randomization security. Never send correct answers during active exam.

## 10. Reliability
Implement:
- Server-side attempt/answer persistence
- Client temporary state
- Periodic synchronization
- Reconnect/resume
- Idempotent saves/submission
- Brief internet loss must not lose an attempt

## 11. Results
Student results must not leak before allowed release.

Default/recommended: release after exam availability window ends. Admin can choose automatic or manual release.

Released result:
- Score
- Student answers
- Correct answers
- Per-question marks
- Pending/manual grading status
- Submission ID

Machine grading may happen immediately, but student-facing results obey release policy.

## 12. Admin dashboard
Live:
- expected/enrolled
- started
- in progress
- completed
- not started
- flagged attempts
- tab violations
- reconnect/refresh events
- current activity

Post-exam:
- individual scores
- average/median/min/max
- distribution
- time taken
- question accuracy
- unattempted
- flagged events
- pending grading
- CSV/Excel export

Result table: Roll No | Name | Email | Score | Time | Status | Flags.

Detailed attempt/event timeline required.

## 13. Preview
Admin can preview the exact student experience including randomized order/options, one-question pages, timers, and navigation. Preview must never create a real attempt.

## 14. Admin auth
V1: email + password, secure sessions, password hashing, password reset/change. Super Admin creates admins. Future: Google/DAU auth.

## 15. Database
Initial: PostgreSQL + Prisma.

For local development, run PostgreSQL through Docker Desktop using Docker Compose. Keep database configuration in environment variables so the same application can later use managed PostgreSQL.

Suggested entities:
User/Admin, Role, Course, Exam, ExamSettings, Question, QuestionOption, ExamQuestion, StudentRoster, ExamAttempt, StudentResponse, ExamEvent, Result, AIGrading, MediaAsset, AuditLog.

Keep V1 normalized but not over-engineered.

Create `SCALING.md` documenting future migration from Prisma toward a dedicated FastAPI + SQLAlchemy service and scaling from 200 → 500 → 1000+ users: pooling, caching, queues, object storage/CDN, horizontal scaling, WebSockets/live dashboard, replicas, load testing, etc.

## 16. Stack
Prefer lightweight:
- Next.js + TypeScript + App Router
- PostgreSQL
- Prisma
- Tailwind CSS
- shadcn/ui or similarly lightweight accessible components
- Zod
- Secure cookie/session auth
- Vitest
- Playwright

Verify current package versions and avoid deprecated packages. Minimize dependencies.

## 17. UI
Use these only as visual inspiration, never copy:
- https://www.framer.com/marketplace/components/category/
- https://decorr.framer.website/
- https://groomify.framer.website/
- Figma Quintessential / Almendra references

Style: modern, polished, premium SaaS, clean, typography-focused, responsive, academic/professional, not old-LMS-like.

Original design. Light/dark toggle. Accessible keyboard/focus states. Mobile/tablet/desktop. Student exam UI prioritizes clarity/speed.

## 18. Deployment
Initial target: 200 concurrent students.

Candidate:
- Vercel app
- Managed PostgreSQL such as Neon/Supabase/Railway, after evaluation

Public internet.

Create `.env.example`, production checklist, DB migration instructions, backup/restore, monitoring/logging guidance.

Before actual deployment ASK ME for confirmation and credentials/environment variables. Never deploy automatically.

## 20. API development / Postman

Create and maintain a Postman collection for Quizora APIs. Cover, where applicable:
- Admin authentication
- Course CRUD
- Exam CRUD/settings
- Question CRUD/import
- Exam publish/close
- Student eligibility/start attempt
- Answer save
- Submission
- Results
- Analytics
- Admin monitoring/events

Use Postman for manual API verification during development. Do not put real production credentials/tokens into committed collections; use variables/placeholders.

## 21. GitHub
No repo exists yet.

Prepare git, `.gitignore`, README, docs, migrations, seed/demo data, tests, deployment docs.

If GitHub CLI exists, propose repository creation but ASK before creating/pushing. Never commit secrets.

## 22. Testing
Critical automated tests:

Identity:
- valid/invalid 9-digit ID
- matching/mismatching email
- invalid domain
- roster restriction
- external-student mode

Attempts:
- one attempt
- duplicate blocked
- simultaneous device blocked
- accidental closure/resume
- server-side locking

Randomization:
- questions randomized
- options randomized
- correct mapping remains correct

Navigation:
- backtracking ON works
- backtracking OFF prevents previous/jumping

Timers:
- whole quiz
- per question
- auto-submit
- server-side expiry
- refresh cannot reset
- client clock manipulation cannot extend

Integrity:
- visibilitychange logged
- second violation auto-submits
- refresh/reopen logged
- copy/right-click blocked

Grading:
- MCQ, MSQ policies, T/F, numerical tolerance, text/manual, AI grading, negative marks

Results:
- no early release
- automatic/manual release
- correctness
- exports

Reliability:
- reconnect/resume
- duplicate saves/submissions
- concurrent users

Use Playwright for realistic student flows.

## 23. Security
Frontend is untrusted.

Server enforces authorization, availability, identity, attempt ownership, one-attempt rule, timer, submission state, answer access, grading, result release, admin permissions.

Implement secure cookies, CSRF protection where applicable, validation, ORM-safe DB access, rate limiting, secure headers, XSS protection, upload validation/limits, audit logs, no client secrets, no answer key in active-exam responses.

Treat AI/file uploads as untrusted.

Document browser anti-cheating limitations.

## 24. Phases
### Phase 0 — Inspect + Plan
Inspect repo/tools, Docker Desktop, PostgreSQL/Docker, Git, GitHub CLI, Node/package manager, Postman, and Antigravity setup. Produce architecture, DB schema, risks, phases, first milestone. WAIT for approval.

### Phase 1 — Foundation
Next.js/TS, UI, DB/Prisma, env, auth, roles, migrations, seed.

### Phase 2 — Admin/Courses/Exams
Course, admins, exam CRUD, settings, scheduling, unique links.

### Phase 3 — Questions
All V1 types, editor, media, import, PDF AI extraction/review.

### Phase 4 — Student Exam
Identity, eligibility, device lock, attempt, randomization, navigation, timers, autosave, reconnect, submit.

### Phase 5 — Integrity
Visibility events, warnings, 2-violation auto-submit, refresh/reopen logs, full-screen, copy/right-click.

### Phase 6 — Grading/Results
Grading engine, AI text grading, manual grading, release, result view, exports.

### Phase 7 — Analytics
Live dashboard, event timeline, analytics, question analysis.

### Phase 8 — Testing/Security
Unit/integration, Playwright, concurrency/load, security, failure/reconnect.

### Phase 9 — Deployment
Production build, DB migration, env, hosting, monitoring, backups, docs. ASK before deployment.

## 25. Documentation
Create:
- README.md
- ARCHITECTURE.md
- DATABASE.md
- SCALING.md
- SECURITY.md
- DEPLOYMENT.md
- TESTING.md
- `.env.example`

SCALING.md must explain future Prisma/PostgreSQL → FastAPI/SQLAlchemy path and scaling beyond 200 concurrent users.

## 26. Engineering rules
1. Simple, maintainable solutions.
2. Do not over-engineer V1.
3. No IE403-specific hard-coding.
4. Configurable course/exam/instructor data.
5. AI provider abstraction.
6. Storage provider abstraction where practical.
7. Frontend never trusted for security.
8. Never expose answer keys during active attempts.
9. Server-authoritative time.
10. Idempotent submission.
11. Retry-safe answer saves.
12. Graceful reconnect.
13. Tests alongside critical exam logic.
14. Minimal dependencies.
15. Original UI.
16. Never commit secrets.
17. Flag conflicts instead of silently changing requirements.
18. Explain major architecture tradeoffs and ask approval.
19. Ask before GitHub creation/push.
20. Ask before deployment.

## 27. V1 vs V2
### V1
Everything specified above for a real 200-student exam:
admin auth/roles, courses/exams, scheduling, unique links, roster/external mode, all question types, manual + bulk + AI import, media/equations/tables/code, randomization, backtracking toggle, timers, one attempt, device locking, autosave/reconnect, tab detection, full-screen, grading, AI-assisted text grading, result release, live monitoring, analytics, exports, light/dark UI, security, tests, docs, deployment readiness.

### V2
Plan but do not implement unless approved:
- multiple labs/batches
- multiple courses/instructors
- global reusable question bank
- tags/categories
- advanced proctoring
- email notifications
- Google/DAU auth
- advanced analytics
- larger-scale infrastructure

## 28. First task — DO NOT CODE
First:
1. Inspect existing repository.
2. Inspect available tooling.
3. Check existing project status.
4. Check Node/package manager.
5. Check PostgreSQL.
6. Check Git/GitHub CLI.
7. Summarize proposed architecture.
8. Propose DB schema/entities/relationships.
9. Identify hardest/risk areas.
10. Propose implementation phases.
11. Propose first milestone.
12. Tell me exactly what you need from me.
13. WAIT for approval before modifying files.

Goal: reliable production-capable quiz platform, initially for 200 concurrent students, later scalable into a multi-course assessment system.

## 29. Project/tooling note

The application name is **Quizora**. Use Quizora consistently in UI branding, metadata, README, seed/demo data, documentation, and deployment configuration where appropriate.

Expected development workflow:
1. Claude Code — primary implementation.
2. Docker Desktop — local PostgreSQL/services.
3. Postman — API testing.
4. Antigravity — optional agentic/browser/UI verification.
5. Git/GitHub — version control.
6. Managed PostgreSQL + Vercel (or another approved deployment) — initial public deployment.

None of these developer tools should become a production runtime dependency.
