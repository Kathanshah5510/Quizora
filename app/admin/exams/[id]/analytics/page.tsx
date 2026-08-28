import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Analytics" };

interface QuestionRow {
  id: string;
  text: string;
  type: string;
  displayOrder: number;
  marks: number;
}

interface Props {
  params: Promise<{ id: string }>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function AnalyticsPage({ params }: Props) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId } = await params;

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      course: { select: { code: true } },
      _count: { select: { questions: true, roster: true, attempts: true } },
    },
  });
  if (!exam) notFound();

  const questions = await db.question.findMany({
    where: { examId },
    orderBy: { displayOrder: "asc" },
    select: { id: true, text: true, type: true, displayOrder: true, marks: true },
  });
  const questionMap = new Map<string, QuestionRow>(questions.map((q) => [q.id, { ...q, marks: Number(q.marks) }]));

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

  const gradedAttempts = attempts.filter(
    (a) => a.result && a.result.gradingStatus === "COMPLETE"
  );
  const scores = gradedAttempts.map((a) => Number(a.result!.totalScore));
  const maxPossible =
    gradedAttempts.length > 0 ? Number(gradedAttempts[0].result!.maxScore) : null;

  function computeMean(arr: number[]) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  function computeMedian(arr: number[]) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  const avgScore = computeMean(scores);
  const medScore = computeMedian(scores);

  // Question-level stats
  const questionStats: Record<string, { correct: number; attempted: number; totalEarned: number }> = {};
  for (const a of attempts) {
    if (!a.result?.perQuestionMarks) continue;
    const perQ = a.result.perQuestionMarks as Record<
      string,
      { earned: number; isCorrect: boolean; status: string }
    >;
    for (const [qId, mark] of Object.entries(perQ)) {
      if (!questionStats[qId]) questionStats[qId] = { correct: 0, attempted: 0, totalEarned: 0 };
      if (mark.status !== "skipped") {
        questionStats[qId].attempted++;
        if (mark.isCorrect) questionStats[qId].correct++;
        questionStats[qId].totalEarned += mark.earned;
      }
    }
  }

  const orderedQuestionStats = questions
    .map((q) => {
      const s = questionStats[q.id] ?? { correct: 0, attempted: 0, totalEarned: 0 };
      return {
        q,
        attempted: s.attempted,
        correctPct: s.attempted > 0 ? Math.round((s.correct / s.attempted) * 100) : null,
        avgEarned: s.attempted > 0 ? s.totalEarned / s.attempted : null,
      };
    })
    .filter((row) => questionMap.has(row.q.id));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          href={`/admin/exams/${examId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {exam.title}
        </Link>
        <h1 className="text-xl font-bold text-foreground mt-1">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{exam.course.code}</p>
      </div>

      {/* Attempt overview */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Attempts</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Attempts" value={totalAttempts} />
          <StatCard label="Submitted" value={submittedCount} />
          <StatCard label="Expired" value={expiredCount} />
          <StatCard label="Abandoned" value={abandonedCount} />
        </div>
      </div>

      {/* Score distribution */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Score Distribution{" "}
          <span className="normal-case font-normal">
            ({gradedAttempts.length} fully graded)
          </span>
        </h2>
        {gradedAttempts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-6 text-sm text-muted-foreground">
            No fully graded attempts yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              label="Min Score"
              value={Math.min(...scores).toFixed(2)}
              sub={maxPossible != null ? `out of ${maxPossible}` : undefined}
            />
            <StatCard
              label="Max Score"
              value={Math.max(...scores).toFixed(2)}
              sub={maxPossible != null ? `out of ${maxPossible}` : undefined}
            />
            <StatCard
              label="Mean Score"
              value={avgScore != null ? avgScore.toFixed(2) : "—"}
            />
            <StatCard
              label="Median Score"
              value={medScore != null ? medScore.toFixed(2) : "—"}
            />
            <StatCard
              label="Mean %"
              value={
                avgScore != null && maxPossible != null && maxPossible > 0
                  ? `${((avgScore / maxPossible) * 100).toFixed(1)}%`
                  : "—"
              }
            />
          </div>
        )}
      </div>

      {/* Per-question breakdown */}
      {orderedQuestionStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Per-Question Performance
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8">#</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Question</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Attempted</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">% Correct</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Avg Earned</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orderedQuestionStats.map(({ q, attempted, correctPct, avgEarned }) => (
                    <tr key={q.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{q.displayOrder + 1}</td>
                      <td className="px-4 py-3 text-foreground max-w-xs">
                        <p className="truncate text-sm">{q.text}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden sm:table-cell">
                        {q.type}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">{attempted}</td>
                      <td className="px-4 py-3 text-right">
                        {correctPct != null ? (
                          <span
                            className={`font-medium ${
                              correctPct >= 60
                                ? "text-green-700 dark:text-green-400"
                                : correctPct >= 30
                                ? "text-yellow-700 dark:text-yellow-400"
                                : "text-red-700 dark:text-red-400"
                            }`}
                          >
                            {correctPct}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {avgEarned != null ? avgEarned.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                        {Number(q.marks).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
