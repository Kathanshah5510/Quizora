import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: examId } = await params;

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      course: { select: { code: true } },
      _count: { select: { questions: true, attempts: true, roster: true } },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  // Fetch all terminal attempts with their results and perQuestionMarks
  const attempts = await db.examAttempt.findMany({
    where: { examId, status: { in: ["SUBMITTED", "EXPIRED"] } },
    select: {
      id: true,
      status: true,
      result: {
        select: {
          totalScore: true,
          maxScore: true,
          gradingStatus: true,
          perQuestionMarks: true,
        },
      },
    },
  });

  const totalAttempts = exam._count.attempts;
  const terminalCount = attempts.length;
  const submittedCount = attempts.filter((a) => a.status === "SUBMITTED").length;
  const expiredCount = attempts.filter((a) => a.status === "EXPIRED").length;
  const abandonedCount = totalAttempts - terminalCount;

  // Score distribution — only include attempts with a complete result
  const gradedAttempts = attempts.filter(
    (a) => a.result && a.result.gradingStatus === "COMPLETE"
  );

  const scores = gradedAttempts.map((a) => {
    const total = Number(a.result!.totalScore);
    const max = Number(a.result!.maxScore);
    return { total, max, pct: max > 0 ? (total / max) * 100 : null };
  });

  const n = scores.length;
  const scoreValues = scores.map((s) => s.total);
  const pctValues = scores.filter((s) => s.pct != null).map((s) => s.pct as number);

  function mean(arr: number[]): number | null {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  function median(arr: number[]): number | null {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function stddev(arr: number[], avg: number): number | null {
    if (arr.length < 2) return null;
    const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  const avgScore = mean(scoreValues);
  const medScore = median(scoreValues);
  const sdScore = avgScore != null ? stddev(scoreValues, avgScore) : null;
  const maxPossible = n > 0 ? Number(gradedAttempts[0].result!.maxScore) : null;

  // Grading status breakdown
  const gradingBreakdown = { PENDING: 0, PARTIAL: 0, COMPLETE: 0 };
  for (const a of attempts) {
    if (a.result) {
      gradingBreakdown[a.result.gradingStatus as keyof typeof gradingBreakdown] =
        (gradingBreakdown[a.result.gradingStatus as keyof typeof gradingBreakdown] ?? 0) + 1;
    } else {
      gradingBreakdown.PENDING++;
    }
  }

  // Question-level stats from perQuestionMarks
  const questionStats: Record<
    string,
    { correct: number; attempted: number; totalEarned: number; totalMax: number }
  > = {};

  for (const a of attempts) {
    if (!a.result?.perQuestionMarks) continue;
    const perQ = a.result.perQuestionMarks as Record<
      string,
      { earned: number; max: number; isCorrect: boolean; status: string }
    >;
    for (const [qId, mark] of Object.entries(perQ)) {
      if (!questionStats[qId]) {
        questionStats[qId] = { correct: 0, attempted: 0, totalEarned: 0, totalMax: 0 };
      }
      if (mark.status !== "skipped") {
        questionStats[qId].attempted++;
        if (mark.isCorrect) questionStats[qId].correct++;
        questionStats[qId].totalEarned += mark.earned;
        questionStats[qId].totalMax += mark.max;
      }
    }
  }

  const questionBreakdown = Object.entries(questionStats).map(([questionId, stats]) => ({
    questionId,
    attempted: stats.attempted,
    correctCount: stats.correct,
    correctPct: stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0,
    avgEarned:
      stats.attempted > 0
        ? Math.round((stats.totalEarned / stats.attempted) * 100) / 100
        : 0,
    maxMarks: stats.attempted > 0 ? stats.totalMax / stats.attempted : 0,
  }));

  return NextResponse.json({
    examId,
    examTitle: exam.title,
    courseCode: exam.course.code,
    totalRostered: exam._count.roster,
    totalAttempts,
    submittedCount,
    expiredCount,
    abandonedCount,
    gradedCount: n,
    gradingBreakdown,
    scoreStats:
      n > 0
        ? {
            maxPossible,
            min: Math.min(...scoreValues),
            max: Math.max(...scoreValues),
            mean: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
            median: medScore != null ? Math.round(medScore * 100) / 100 : null,
            stddev: sdScore != null ? Math.round(sdScore * 100) / 100 : null,
            meanPct: mean(pctValues) != null ? Math.round(mean(pctValues)! * 10) / 10 : null,
          }
        : null,
    questionBreakdown,
  });
}
