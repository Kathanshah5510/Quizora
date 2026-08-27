import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ log: ["query", "error"] });

async function main() {
  // Raw query to confirm columns exist at runtime
  const cols = await db.$queryRawUnsafe<{ column_name: string; table_name: string }[]>(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_name IN ('exams','exam_attempts')
      AND column_name IN ('reconnect_grace_seconds','max_tab_violations','max_tab_violations_snapshot')
    ORDER BY table_name, column_name
  `);
  console.log("DB columns visible to Prisma client:", JSON.stringify(cols, null, 2));

  // Try a minimal select with just id
  const exam = await db.exam.findFirst({ select: { id: true, slug: true } });
  console.log("First exam (id+slug only):", exam);

  // Now try the new fields
  const exam2 = await db.exam.findFirst({
    select: { id: true, reconnectGraceSeconds: true, maxTabViolations: true },
  });
  console.log("First exam (new fields):", exam2);
}

main().catch(console.error).finally(() => db.$disconnect());
