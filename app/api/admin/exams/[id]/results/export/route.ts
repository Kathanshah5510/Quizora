import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildResultSummary } from "@/lib/results/resultDomain";

/** Sanitize a CSV cell value to prevent formula injection attacks. */
function sanitizeCell(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  // Strip leading characters that spreadsheet apps interpret as formulas
  const sanitized = str.replace(/^[=+\-@\t\r]/, "'$&");
  // Wrap in quotes and escape internal quotes
  return `"${sanitized.replace(/"/g, '""')}"`;
}

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(sanitizeCell).join(",");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId } = await params;

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { title: true, slug: true },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const attempts = await db.examAttempt.findMany({
    where: { examId },
    orderBy: [{ submittedAt: "desc" }, { studentId: "asc" }],
    select: {
      studentId: true,
      studentName: true,
      studentEmail: true,
      attemptNumber: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      tabViolations: true,
      submissionId: true,
      result: {
        select: {
          totalScore: true,
          maxScore: true,
          gradingStatus: true,
          isReleased: true,
          releasedAt: true,
        },
      },
    },
  });

  const headers = [
    "Student ID",
    "Name",
    "Email",
    "Attempt #",
    "Status",
    "Grading Status",
    "Total Score",
    "Max Score",
    "Percentage",
    "Released",
    "Started At",
    "Submitted At",
    "Tab Violations",
    "Submission ID",
  ];

  const lines: string[] = [headers.map(sanitizeCell).join(",")];

  for (const a of attempts) {
    const result = a.result ? buildResultSummary(a.result) : null;
    lines.push(
      row([
        a.studentId,
        a.studentName,
        a.studentEmail,
        a.attemptNumber,
        a.status,
        result?.gradingStatus ?? "",
        result != null ? result.totalScore : "",
        result != null ? result.maxScore : "",
        result?.percentage != null ? `${result.percentage.toFixed(2)}%` : "",
        a.result?.isReleased ? "Yes" : "No",
        a.startedAt.toISOString(),
        a.submittedAt?.toISOString() ?? "",
        a.tabViolations,
        a.submissionId ?? "",
      ])
    );
  }

  const csv = lines.join("\r\n");
  const filename = `${exam.slug}-results.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
