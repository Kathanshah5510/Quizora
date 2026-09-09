import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

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

  console.log("\nSeed complete.");
  console.log("─────────────────────────────────────────");
  console.log("Login credentials (change after first use):");
  console.log("  Super Admin  superadmin@quizora.local / SuperAdmin@123");
  console.log("─────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
