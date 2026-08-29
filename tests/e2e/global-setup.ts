import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

// Load environment variables before connecting to the DB
config({ path: ".env.local" });
config({ path: ".env" });

export const E2E_EXAM_SLUG = "e2e-quiz-alpha-001";
export const E2E_EXAM_TITLE = "E2E Test Quiz Alpha";

// Students used across the e2e suite
export const STUDENTS = [
  { studentId: "221090001", name: "Test Student Alpha" },
  { studentId: "221090002", name: "Test Student Beta" },
  { studentId: "221090003", name: "Test Student Gamma" },
  { studentId: "221090004", name: "Test Student Delta" },
  { studentId: "221090005", name: "Test Student Epsilon" },
];

export default async function globalSetup() {
  const db = new PrismaClient();

  try {
    // Find or create a course to attach the exam to
    let course = await db.course.findUnique({ where: { code: "IE403" } });
    if (!course) {
      const admin = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
      if (!admin) throw new Error("No admin user found — run db:seed first");
      course = await db.course.create({
        data: {
          name: "Machine Learning",
          code: "IE403",
          description: "Introduction to Machine Learning",
          createdById: admin.id,
        },
      });
    }

    const admin = await db.user.findFirst();
    if (!admin) throw new Error("No admin user found");

    // Remove stale e2e exam if it exists
    const stale = await db.exam.findUnique({ where: { slug: E2E_EXAM_SLUG } });
    if (stale) {
      const staleAttempts = await db.examAttempt.findMany({
        where: { examId: stale.id },
        select: { id: true },
      });
      if (staleAttempts.length > 0) {
        const ids = staleAttempts.map((a) => a.id);
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
        await db.examAttempt.deleteMany({ where: { examId: stale.id } });
      }
      // Exam cascade deletes StudentRoster + Question + QuestionOption
      await db.exam.delete({ where: { id: stale.id } });
    }

    // Create a PUBLISHED exam with one MCQ question
    const exam = await db.exam.create({
      data: {
        courseId: course.id,
        title: E2E_EXAM_TITLE,
        description: "Automated E2E test exam — do not edit.",
        instructorName: "E2E Instructor",
        slug: E2E_EXAM_SLUG,
        status: "PUBLISHED",
        durationMinutes: 30,
        attemptsAllowed: 1,
        defaultMarks: 1,
        defaultNegativeMarks: 0,
        createdById: admin.id,
      },
    });

    // Add one MCQ question
    const question = await db.question.create({
      data: {
        examId: exam.id,
        type: "MCQ",
        text: "Which of the following is a supervised learning algorithm?",
        displayOrder: 1,
        marks: 1,
        negativeMarks: 0,
        options: {
          create: [
            { text: "K-Means Clustering", displayOrder: 1, isCorrect: false },
            { text: "Linear Regression", displayOrder: 2, isCorrect: true },
            { text: "DBSCAN", displayOrder: 3, isCorrect: false },
            { text: "PCA", displayOrder: 4, isCorrect: false },
          ],
        },
      },
    });

    // Add all test students to the roster
    await db.studentRoster.createMany({
      data: STUDENTS.map((s) => ({
        examId: exam.id,
        studentId: s.studentId,
        email: `${s.studentId}@dau.ac.in`,
        name: s.name,
      })),
      skipDuplicates: true,
    });

    console.log(`[e2e setup] Created exam "${E2E_EXAM_TITLE}" (${exam.id}) with question ${question.id}`);
    console.log(`[e2e setup] Roster: ${STUDENTS.length} students`);
  } finally {
    await db.$disconnect();
  }
}
