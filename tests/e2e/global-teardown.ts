import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { E2E_EXAM_SLUG } from "./global-setup";

config({ path: ".env.local" });
config({ path: ".env" });

async function cleanupAttempts(db: PrismaClient, examId: string) {
  const attempts = await db.examAttempt.findMany({
    where: { examId },
    select: { id: true },
  });
  if (attempts.length === 0) return;

  const ids = attempts.map((a) => a.id);

  // Collect StudentResponse IDs to delete AIGrading first
  const responses = await db.studentResponse.findMany({
    where: { attemptId: { in: ids } },
    select: { id: true },
  });
  if (responses.length > 0) {
    const rIds = responses.map((r) => r.id);
    await db.aIGrading.deleteMany({ where: { responseId: { in: rIds } } });
    await db.studentResponse.deleteMany({ where: { id: { in: rIds } } });
  }

  await db.examEvent.deleteMany({ where: { attemptId: { in: ids } } });
  await db.result.deleteMany({ where: { attemptId: { in: ids } } });
  await db.examAttempt.deleteMany({ where: { examId } });
}

export default async function globalTeardown() {
  const db = new PrismaClient();

  try {
    const exam = await db.exam.findUnique({ where: { slug: E2E_EXAM_SLUG } });
    if (exam) {
      await cleanupAttempts(db, exam.id);
      // Exam deletion cascades: StudentRoster, Question (→ QuestionOption)
      await db.exam.delete({ where: { id: exam.id } });
      console.log(`[e2e teardown] Deleted e2e exam ${exam.id}`);
    }
  } finally {
    await db.$disconnect();
  }
}
