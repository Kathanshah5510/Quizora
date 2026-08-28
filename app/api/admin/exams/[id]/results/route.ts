import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildResultSummary } from "@/lib/results/resultDomain";

const PAGE_SIZE = 25;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId } = await params;

  // Verify exam exists and is accessible
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, title: true, resultRelease: true },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? undefined;
  const gradingFilter = searchParams.get("gradingStatus") ?? undefined;
  const search = searchParams.get("search")?.trim() ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const where = {
    examId,
    ...(statusFilter ? { status: statusFilter as never } : {}),
    ...(gradingFilter
      ? { result: { gradingStatus: gradingFilter as never } }
      : {}),
    ...(search
      ? {
          OR: [
            { studentId: { contains: search, mode: "insensitive" as const } },
            { studentName: { contains: search, mode: "insensitive" as const } },
            { studentEmail: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, attempts] = await Promise.all([
    db.examAttempt.count({ where }),
    db.examAttempt.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        studentId: true,
        studentName: true,
        studentEmail: true,
        attemptNumber: true,
        status: true,
        submittedAt: true,
        startedAt: true,
        submissionId: true,
        result: {
          select: {
            id: true,
            totalScore: true,
            maxScore: true,
            gradingStatus: true,
            isReleased: true,
            releasedAt: true,
          },
        },
      },
    }),
  ]);

  const rows = attempts.map((a) => ({
    id: a.id,
    studentId: a.studentId,
    studentName: a.studentName,
    studentEmail: a.studentEmail,
    attemptNumber: a.attemptNumber,
    status: a.status,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    startedAt: a.startedAt.toISOString(),
    submissionId: a.submissionId,
    result: a.result ? buildResultSummary(a.result) : null,
  }));

  return NextResponse.json({
    exam: { id: exam.id, title: exam.title, resultRelease: exam.resultRelease },
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    attempts: rows,
  });
}
