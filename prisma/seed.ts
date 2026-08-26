import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Super Admin
  const superAdminPassword = await bcrypt.hash("SuperAdmin@123", 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@quizora.local" },
    update: {},
    create: {
      email: "superadmin@quizora.local",
      passwordHash: superAdminPassword,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`  ✓ Super admin: ${superAdmin.email}`);

  // Admin (TA)
  const adminPassword = await bcrypt.hash("Admin@123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@quizora.local" },
    update: {},
    create: {
      email: "admin@quizora.local",
      passwordHash: adminPassword,
      name: "Prof. Demo Admin",
      role: Role.ADMIN,
    },
  });
  console.log(`  ✓ Admin: ${admin.email}`);

  // Sample course
  const course = await prisma.course.upsert({
    where: { code: "IE403" },
    update: {},
    create: {
      name: "Machine Learning",
      code: "IE403",
      description: "Introduction to Machine Learning — IE403",
      createdById: admin.id,
    },
  });
  console.log(`  ✓ Course: ${course.code} — ${course.name}`);

  // Sample exam (draft, no questions)
  const existingExam = await prisma.exam.findUnique({ where: { slug: "ie403-ml-quiz-1-demo" } });
  if (!existingExam) {
    const exam = await prisma.exam.create({
      data: {
        courseId: course.id,
        title: "ML Quiz 1 — Demo",
        description: "Sample quiz for demonstration purposes. Not active.",
        instructorName: "Prof. Arunava Chakravarty",
        taNames: ["TA One", "TA Two"],
        slug: "ie403-ml-quiz-1-demo",
        durationMinutes: 60,
        attemptsAllowed: 1,
        defaultMarks: 1,
        defaultNegativeMarks: 0,
        createdById: admin.id,
      },
    });
    console.log(`  ✓ Sample exam: ${exam.slug}`);
  } else {
    console.log(`  ✓ Sample exam: ie403-ml-quiz-1-demo (already exists)`);
  }

  console.log("\nSeed complete.");
  console.log("─────────────────────────────────────────");
  console.log("Login credentials (change after first use):");
  console.log("  Super Admin  superadmin@quizora.local / SuperAdmin@123");
  console.log("  Admin        admin@quizora.local      / Admin@123456");
  console.log("─────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
