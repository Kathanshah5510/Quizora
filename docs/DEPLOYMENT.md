# Deployment

> **Note:** Production deployment requires explicit approval. Do not deploy without confirming with the project owner.

## Target stack

- **Frontend + API:** Vercel (Next.js serverless)
- **Database:** Neon PostgreSQL (serverless, built-in PgBouncer)
- **Media storage:** Cloudflare R2 or AWS S3

## Pre-deployment checklist

- [ ] All tests pass (`npm run test`)
- [ ] Production build succeeds (`npm run build`)
- [ ] `.env.example` is up to date
- [ ] No secrets in committed files (`git log --all -p | grep -i password` etc.)
- [ ] `SESSION_SECRET` is a random 32+ char string
- [ ] Database migrations are applied
- [ ] Seed data is NOT applied to production (production starts clean)
- [ ] GEMINI_API_KEY is set for AI features
- [ ] Storage provider configured (LOCAL only for dev)

## Environment variables (production)

Copy `.env.example` and fill in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon dashboard → Connection string (pooled) |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Your production domain |
| `GEMINI_API_KEY` | Google AI Studio |
| `STORAGE_PROVIDER` | `s3` or `r2` |
| `STORAGE_BUCKET` etc. | AWS / Cloudflare R2 dashboard |

## Vercel deployment

1. Connect the GitHub repo to Vercel
2. Set all environment variables in Vercel project settings
3. Deploy — Vercel auto-detects Next.js

## Database migration (production)

```bash
# Run once after each release that includes schema changes
DATABASE_URL=<prod-url> npx prisma migrate deploy
```

`migrate deploy` applies migrations without interactive prompts, safe for CI/CD.

## Backup and restore

### Neon
- Point-in-time recovery available in Neon dashboard
- Schedule nightly logical backups with `pg_dump`:
  ```bash
  pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%Y%m%d).dump
  ```

### Restore
```bash
pg_restore -d "$DATABASE_URL" backup_YYYYMMDD.dump
```

## Monitoring

- Vercel dashboard: function invocations, errors, latency
- Neon dashboard: query performance, connection counts
- Application logs: structured JSON via `console.error` / `console.info`
- Add Sentry or Datadog in V2 for real-time error tracking

## Rollback

1. Revert to previous Vercel deployment (instant, no downtime)
2. If schema was changed: run `prisma migrate resolve --rolled-back <migration-name>`
