/**
 * Seeds a minimal exam for load testing.
 * Run with: npx tsx scripts/seed-load-test.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Find an existing admin user to use as createdBy
  const adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });
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
    if (qCount < 5) {
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
  for (let i = 1; i <= 5; i++) {
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
