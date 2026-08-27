-- AlterTable: Add configurable integrity thresholds to exams
ALTER TABLE "exams" ADD COLUMN "reconnect_grace_seconds" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "exams" ADD COLUMN "max_tab_violations" INTEGER NOT NULL DEFAULT 2;

-- AlterTable: Snapshot maxTabViolations into each attempt at creation (immutable after that)
ALTER TABLE "exam_attempts" ADD COLUMN "max_tab_violations_snapshot" INTEGER NOT NULL DEFAULT 2;
