-- AlterTable: Add configurable integrity thresholds to exams
-- Column names use Prisma camelCase convention (no @map directive on these fields)
ALTER TABLE "exams" ADD COLUMN "reconnectGraceSeconds" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "exams" ADD COLUMN "maxTabViolations"      INTEGER NOT NULL DEFAULT 2;

-- AlterTable: Snapshot maxTabViolations into each attempt at creation (immutable after that)
ALTER TABLE "exam_attempts" ADD COLUMN "maxTabViolationsSnapshot" INTEGER NOT NULL DEFAULT 2;
