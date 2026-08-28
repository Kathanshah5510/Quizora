import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import GradeResponseForm from "./GradeResponseForm";
import AIGradeControls from "./AIGradeControls";

export const metadata: Metadata = { title: "Grade Responses" };

interface Props {
  params: Promise<{ id: string; attemptId: string }>;
}

export default async function GradeResponsesPage({ params }: Props) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId, attemptId } = await params;

  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId },
    select: {
      id: true,
      studentName: true,
      studentId: true,
      exam: { select: { title: true } },
      result: {
        select: {
          id: true,
          gradingStatus: true,
          perQuestionMarks: true,
        },
      },
      responses: {
        select: {
          id: true,
          questionId: true,
          textAnswer: true,
          aiGrading: {
            select: {
              id: true,
              aiScore: true,
              aiRationale: true,
              aiModel: true,
              adminApprovedScore: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!attempt) notFound();

  // Only SHORT_TEXT questions need manual grading
  const shortTextQuestions = await db.question.findMany({
    where: { examId, type: "SHORT_TEXT" },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      text: true,
      marks: true,
      textAnswer: true,
    },
  });

  const responseMap = new Map(attempt.responses.map((r) => [r.questionId, r]));
  const perQ = (attempt.result?.perQuestionMarks ?? {}) as Record<
    string,
    { earned: number; max: number; isCorrect: boolean; status: string }
  >;

  const pendingQuestions = shortTextQuestions.filter(
    (q) => !perQ[q.id] || perQ[q.id].status === "pending"
  );

  const gradedQuestions = shortTextQuestions.filter(
    (q) => perQ[q.id] && perQ[q.id].status === "graded"
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <Link
          href={`/admin/exams/${examId}/results/${attemptId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Attempt Review
        </Link>
        <h1 className="text-xl font-bold text-foreground mt-1">Grade Responses</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {attempt.studentName} ({attempt.studentId}) — {attempt.exam.title}
        </p>
      </div>

      {pendingQuestions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-8 text-center">
          <p className="text-sm font-medium text-foreground">All responses graded</p>
          <p className="text-xs text-muted-foreground mt-1">
            No pending SHORT_TEXT questions remain.
          </p>
          <Link
            href={`/admin/exams/${examId}/results/${attemptId}`}
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Back to Attempt Review
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {pendingQuestions.length} pending question{pendingQuestions.length !== 1 ? "s" : ""}
            {gradedQuestions.length > 0 && ` · ${gradedQuestions.length} already graded`}
          </p>

          <div className="space-y-4">
            {pendingQuestions.map((q, idx) => {
              const resp = responseMap.get(q.id) ?? null;
              const existing = perQ[q.id] ?? null;
              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-border bg-card px-6 py-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground font-mono">
                        Q{idx + 1} · SHORT_TEXT · {Number(q.marks)} mark{Number(q.marks) !== 1 ? "s" : ""}
                      </span>
                      <p className="text-sm font-medium text-foreground mt-1">{q.text}</p>
                    </div>
                  </div>

                  {/* Student answer */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Student's answer</p>
                    <p className={`text-sm rounded-lg border border-border bg-muted/40 px-3 py-2 ${resp?.textAnswer ? "text-foreground" : "text-muted-foreground italic"}`}>
                      {resp?.textAnswer || "No answer provided (skipped)"}
                    </p>
                  </div>

                  {/* Expected answer (reference) */}
                  {q.textAnswer && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Expected answer</p>
                      <p className="text-sm rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-green-800 dark:text-green-300">
                        {q.textAnswer}
                      </p>
                    </div>
                  )}

                  {/* Grade form — only when response exists */}
                  {resp ? (
                    <>
                      {/* AI grading suggestion */}
                      <AIGradeControls
                        examId={examId}
                        attemptId={attemptId}
                        responseId={resp.id}
                        maxMarks={Number(q.marks)}
                        aiGrading={
                          resp.aiGrading
                            ? {
                                aiScore: Number(resp.aiGrading.aiScore),
                                aiRationale: resp.aiGrading.aiRationale ?? "",
                                aiModel: resp.aiGrading.aiModel ?? "",
                                adminApprovedScore: resp.aiGrading.adminApprovedScore != null
                                  ? Number(resp.aiGrading.adminApprovedScore)
                                  : null,
                                status: resp.aiGrading.status,
                              }
                            : null
                        }
                      />
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Assign marks manually</p>
                        <GradeResponseForm
                          examId={examId}
                          attemptId={attemptId}
                          responseId={resp.id}
                          maxMarks={Number(q.marks)}
                          currentEarned={existing?.status === "graded" ? existing.earned : null}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No response submitted — question was skipped.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Already-graded summary */}
          {gradedQuestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Already Graded
              </p>
              {gradedQuestions.map((q) => {
                const grade = perQ[q.id];
                const resp = responseMap.get(q.id);
                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-border bg-card px-6 py-4 flex items-start justify-between gap-4 opacity-70"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-mono">SHORT_TEXT</p>
                      <p className="text-sm font-medium text-foreground mt-0.5 line-clamp-2">{q.text}</p>
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {resp?.textAnswer || "skipped"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {grade.earned.toFixed(2)} / {grade.max.toFixed(2)}
                      </p>
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        graded
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
