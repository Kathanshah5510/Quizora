/**
 * Seeds a minimal exam for load testing.
 * Run with: npx tsx scripts/seed-load-test.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Remove the load-test exam and everything it created. Explicit --cleanup only. */
async function cleanup() {
  const exam = await db.exam.findUnique({
    where: { slug: "test-exam-load" },
    select: { id: true, _count: { select: { attempts: true, questions: true } } },
  });
  if (!exam) {
    console.log("Nothing to clean up — no exam with slug 'test-exam-load'.");
    return;
  }
  console.log(`Removing load-test exam (${exam._count.attempts} attempts, ${exam._count.questions} questions)…`);

  const attempts = await db.examAttempt.findMany({ where: { examId: exam.id }, select: { id: true } });
  const attemptIds = attempts.map((a) => a.id);

  if (attemptIds.length > 0) {
    const responses = await db.studentResponse.findMany({
      where: { attemptId: { in: attemptIds } },
      select: { id: true },
    });
    await db.aIGrading.deleteMany({ where: { responseId: { in: responses.map((r) => r.id) } } });
    await db.studentResponse.deleteMany({ where: { attemptId: { in: attemptIds } } });
    await db.examEvent.deleteMany({ where: { attemptId: { in: attemptIds } } });
    await db.result.deleteMany({ where: { attemptId: { in: attemptIds } } });
    await db.examAttempt.deleteMany({ where: { examId: exam.id } });
  }

  await db.exam.delete({ where: { id: exam.id } }); // questions/options cascade
  const course = await db.course.findFirst({
    where: { code: "TEST101" },
    select: { id: true, _count: { select: { exams: true } } },
  });
  if (course && course._count.exams === 0) await db.course.delete({ where: { id: course.id } });

  console.log("Cleanup complete.");
}

async function main() {
  if (process.argv.includes("--cleanup")) return cleanup();

  // Any admin can own the fixture; production may only have a SUPER_ADMIN.
  const adminUser = await db.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
  });
  if (!adminUser) throw new Error("No admin user found — run the main seed first");
  const adminId = adminUser.id;

  // Find or create a course
  let course = await db.course.findFirst({ where: { code: "TEST101" } });
  if (!course) {
    course = await db.course.create({
      data: { name: "Load Test Course", code: "TEST101", createdById: adminId },
    });
    console.log("Created course:", course.id);
  } else {
    console.log("Using existing course:", course.id);
  }

  // Find or create the exam
  const existingExam = await db.exam.findUnique({ where: { slug: "test-exam-load" } });
  if (existingExam) {
    // Ensure it's ACTIVE and allowExternalStudents
    await db.exam.update({
      where: { id: existingExam.id },
      data: {
        status: "ACTIVE",
        allowExternalStudents: true,
        attemptsAllowed: 999,
        durationMinutes: 30,
        availabilityStart: new Date(Date.now() - 60_000),
        availabilityEnd: new Date(Date.now() + 4 * 60 * 60_000),
      },
    });
    console.log("Updated existing exam:", existingExam.id, existingExam.slug);
    // Check question count
    const qCount = await db.question.count({ where: { examId: existingExam.id } });
    console.log("Questions:", qCount);
    if (qCount < 15) {
      await seedQuestions(existingExam.id);
    }
    return;
  }

  const exam = await db.exam.create({
    data: {
      courseId: course.id,
      createdById: adminId,
      title: "Load Test Exam",
      slug: "test-exam-load",
      instructorName: "Load Test",
      taNames: [],
      status: "ACTIVE",
      durationMinutes: 30,
      timerMode: "WHOLE_QUIZ",
      attemptsAllowed: 999,
      allowExternalStudents: true,
      randomizeQuestions: false,
      randomizeOptions: false,
      allowBacktracking: true,
      availabilityStart: new Date(Date.now() - 60_000),
      availabilityEnd: new Date(Date.now() + 4 * 60 * 60_000),
    },
  });
  console.log("Created exam:", exam.id, exam.slug);
  await seedQuestions(exam.id);
}

async function seedQuestions(examId: string) {
  for (let i = 1; i <= 15; i++) {
    const q = await db.question.create({
      data: {
        examId,
        type: "MCQ",
        text: `Load test question ${i}: What is ${i} + ${i}?`,
        displayOrder: i,
        marks: 1,
        negativeMarks: 0,
      },
    });
    await db.questionOption.createMany({
      data: [
        { questionId: q.id, text: `${i + i} (correct)`, isCorrect: true, displayOrder: 1 },
        { questionId: q.id, text: `${i + i + 1}`, isCorrect: false, displayOrder: 2 },
        { questionId: q.id, text: `${i * i}`, isCorrect: false, displayOrder: 3 },
        { questionId: q.id, text: `${i - 1}`, isCorrect: false, displayOrder: 4 },
      ],
    });
    console.log(`  Created question ${i}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
