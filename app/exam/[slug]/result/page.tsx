"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { APP_TIME_ZONE } from "@/lib/datetime";

interface QuestionResult {
  questionId: string;
  type: string;
  text: string;
  displayOrder: number;
  marks: number;
  // Student's response
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  numericalAnswer: number | null;
  // Correct answers (shown in released results)
  correctOptionIds: string[];
  correctNumericalAnswer: number | null;
  correctNumericalTolerance: number | null;
  expectedTextAnswer: string | null;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
  // Grade
  earned: number | null;
  maxForQuestion: number;
  isCorrect: boolean | null;
  gradingStatus: string;
}

interface ResultData {
  visible: true;
  examTitle: string;
  studentName: string;
  studentId: string;
  submissionId: string | null;
  startedAt: string;
  submittedAt: string | null;
  totalScore: number;
  maxScore: number;
  percentage: number | null;
  gradingStatus: string;
  showAnswers: boolean;
  availabilityEnd: string | null;
  questions: QuestionResult[];
}

interface NotVisibleData {
  visible: false;
  reason: "GRADING_PENDING" | "GRADING_INCOMPLETE" | "NOT_RELEASED";
}

type ApiResponse = ResultData | NotVisibleData;

const REASON_MESSAGES: Record<string, string> = {
  GRADING_PENDING: "Your submission is being processed. Please check back shortly.",
  GRADING_INCOMPLETE: "Your exam has been submitted. Results will be available once grading is complete.",
  NOT_RELEASED: "Your exam has been submitted. Results will be shared by your instructor.",
};

function QHeader({ slug, examTitle }: { slug: string; examTitle?: string }) {
  return (
    <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link href={`/exam/${slug}`} className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
            style={{
              background: "linear-gradient(135deg, oklch(0.51 0.22 264), oklch(0.55 0.22 295))",
              boxShadow: "0 0 10px oklch(0.51 0.22 264 / 0.35)",
            }}
          >
            Q
          </div>
          <span className="font-bold text-sm text-foreground">Quizora</span>
        </Link>
        {examTitle && (
          <>
            <span className="text-border">·</span>
            <span className="text-sm text-muted-foreground truncate">{examTitle}</span>
          </>
        )}
      </div>
    </header>
  );
}

export default function ResultPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // localStorage persists after tab close; sessionStorage is the in-tab fallback
    const sessionKey = `quizora_session_${slug}`;
    let raw: string | null = null;
    try { raw = localStorage.getItem(sessionKey); } catch { /* unavailable */ }
    if (!raw) {
      try { raw = sessionStorage.getItem(sessionKey); } catch { /* unavailable */ }
    }
    if (!raw) {
      setError("No exam session found. Please return to the exam start page and re-enter your details.");
      setLoading(false);
      return;
    }

    let parsed: { attemptId?: string; sessionToken?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError("Session data is invalid.");
      setLoading(false);
      return;
    }

    const { attemptId, sessionToken } = parsed;
    if (!attemptId || !sessionToken) {
      setError("Incomplete session data.");
      setLoading(false);
      return;
    }

    fetch(`/api/exam/${slug}/result?attemptId=${encodeURIComponent(attemptId)}`, {
      headers: { "X-Session-Token": sessionToken },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Failed to load results.");
        } else {
          setData(json);
        }
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <QHeader slug={slug} />
        <div className="max-w-2xl mx-auto px-4 py-12 space-y-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-32 mx-auto" />
          <div className="rounded-2xl border border-border bg-card px-8 py-8 space-y-4">
            <div className="h-4 bg-muted rounded w-16 mx-auto" />
            <div className="h-12 bg-muted rounded w-48 mx-auto" />
            <div className="h-8 bg-muted rounded w-24 mx-auto" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <QHeader slug={slug} />
        <div className="flex items-center justify-center px-4 py-20">
          <div className="rounded-xl border border-border bg-card px-8 py-10 text-center max-w-md">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (!data.visible) {
    return (
      <div className="min-h-screen">
        <QHeader slug={slug} />
        <div className="flex items-center justify-center px-4 py-20">
          <div className="rounded-2xl border border-border bg-card px-8 py-12 text-center max-w-md space-y-4">
            <div
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl"
              style={{ background: "linear-gradient(135deg, oklch(0.51 0.22 264 / 0.12), oklch(0.55 0.22 295 / 0.08))" }}
            >
              📋
            </div>
            <h1 className="text-lg font-bold text-foreground">Exam Submitted</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {REASON_MESSAGES[data.reason] ?? "Results are not yet available."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    examTitle,
    studentName,
    studentId,
    submissionId,
    totalScore,
    maxScore,
    percentage,
    gradingStatus,
    showAnswers,
    availabilityEnd,
    questions,
    submittedAt,
  } = data;

  const pctColor =
    percentage == null
      ? "text-foreground"
      : percentage >= 60
      ? "text-green-600 dark:text-green-400"
      : percentage >= 40
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="min-h-screen bg-background">
      <QHeader slug={slug} examTitle={examTitle} />

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Result</p>
          <h1 className="text-xl font-bold text-foreground">{examTitle}</h1>
          <p className="text-xs text-muted-foreground font-mono">
            {studentName} · {studentId}
          </p>
        </div>

        {/* Score card */}
        <div
          className="rounded-2xl border border-border/50 bg-card px-8 py-8 text-center space-y-5"
          style={{ boxShadow: "0 4px 24px oklch(0 0 0 / 0.06)" }}
        >
          {/* Score */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Score</p>
            <p className="text-5xl font-extrabold text-foreground" style={{ letterSpacing: "-0.03em" }}>
              {totalScore.toFixed(2)}
              <span className="text-2xl font-normal text-muted-foreground"> / {maxScore.toFixed(2)}</span>
            </p>
          </div>

          {/* Percentage */}
          {percentage != null && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Percentage</p>
              <p className={`text-3xl font-bold ${pctColor}`}>{percentage.toFixed(1)}%</p>
            </div>
          )}

          {/* Progress bar */}
          {percentage != null && (
            <div className="w-full">
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                    background:
                      percentage >= 60
                        ? "linear-gradient(90deg, oklch(0.55 0.18 160), oklch(0.62 0.20 145))"
                        : percentage >= 40
                        ? "linear-gradient(90deg, oklch(0.72 0.18 80), oklch(0.75 0.20 65))"
                        : "linear-gradient(90deg, oklch(0.60 0.22 25), oklch(0.65 0.24 15))",
                  }}
                />
              </div>
            </div>
          )}

          {/* Partial grading warning */}
          {gradingStatus === "PARTIAL" && (
            <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-4 py-2.5">
              Some questions are still being reviewed. Your final score may change.
            </p>
          )}

          {/* Submission ID */}
          {submissionId && (
            <div className="flex flex-col items-center gap-1.5 pt-1 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Submission ID
              </p>
              <p className="text-xs font-mono text-foreground">{submissionId}</p>
              <CopyButton text={submissionId} />
            </div>
          )}

          {/* Submitted at */}
          {submittedAt && (
            <p className="text-xs text-muted-foreground">
              Submitted{" "}
              {new Date(submittedAt).toLocaleString("en-IN", {
                timeZone: APP_TIME_ZONE,
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>

        {/* Correct answers note */}
        {!showAnswers && (
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: "oklch(0.82 0.08 80 / 0.6)",
              background: "oklch(0.97 0.02 80 / 0.4)",
              color: "oklch(0.42 0.10 80)",
            }}
          >
            Correct answers will be visible after the exam availability window closes
            {availabilityEnd
              ? ` (${new Date(availabilityEnd).toLocaleString("en-IN", { timeZone: APP_TIME_ZONE, dateStyle: "medium", timeStyle: "short" })}).`
              : "."}
          </div>
        )}

        {/* Per-question breakdown */}
        {showAnswers && questions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Question Breakdown</h2>
            {questions.map((q, idx) => {
              const selectedSet = new Set(q.selectedOptionIds ?? []);
              const correctSet = new Set(q.correctOptionIds);
              const hasOptions = q.options.length > 0;

              return (
                <div
                  key={q.questionId}
                  className={`rounded-xl border bg-card px-5 py-4 space-y-3 ${
                    q.isCorrect === true
                      ? "border-green-200 dark:border-green-800"
                      : q.isCorrect === false
                      ? "border-red-200 dark:border-red-800"
                      : "border-border"
                  }`}
                >
                  {/* Question header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-muted-foreground">Q{idx + 1}</span>
                        <span className="text-xs rounded bg-muted px-1.5 py-0.5 font-mono">{q.type}</span>
                        {q.gradingStatus === "pending" && (
                          <span className="text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5">
                            Pending
                          </span>
                        )}
                        {q.isCorrect === true && (
                          <span className="text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5">
                            Correct
                          </span>
                        )}
                        {q.isCorrect === false && (
                          <span className="text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5">
                            Incorrect
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1.5 leading-snug">{q.text}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {q.earned != null ? q.earned.toFixed(2) : "—"}
                        <span className="text-muted-foreground font-normal"> / {q.maxForQuestion.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Options (MCQ / MSQ / TRUE_FALSE / IMAGE_BASED) */}
                  {hasOptions && (
                    <div className="space-y-1.5 pl-2">
                      {q.options.map((opt) => {
                        const selected = selectedSet.has(opt.id);
                        const correct = correctSet.has(opt.id);
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                              selected && correct
                                ? "bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800"
                                : selected && !correct
                                ? "bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800"
                                : correct && !selected
                                ? "bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                                : "border border-transparent"
                            }`}
                          >
                            <span className="text-xs text-muted-foreground w-4 shrink-0">
                              {selected ? "●" : "○"}
                            </span>
                            <span
                              className={`flex-1 ${selected ? "font-medium" : ""} ${
                                correct ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {opt.text}
                            </span>
                            {correct && (
                              <span className="text-xs text-green-700 dark:text-green-400 font-medium shrink-0">
                                correct
                              </span>
                            )}
                            {selected && !correct && (
                              <span className="text-xs text-red-700 dark:text-red-400 font-medium shrink-0">
                                wrong
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* NUMERICAL */}
                  {q.type === "NUMERICAL" && (
                    <div className="pl-2 space-y-1 text-sm">
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <span className="text-xs text-muted-foreground">Your answer: </span>
                          <span
                            className={`font-mono font-medium ${
                              q.numericalAnswer != null ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {q.numericalAnswer != null ? q.numericalAnswer : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Correct: </span>
                          <span className="font-mono font-medium text-green-700 dark:text-green-400">
                            {q.correctNumericalAnswer != null ? q.correctNumericalAnswer : "—"}
                            {q.correctNumericalTolerance != null && ` ±${q.correctNumericalTolerance}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SHORT_TEXT */}
                  {q.type === "SHORT_TEXT" && (
                    <div className="pl-2 space-y-1 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Your answer: </span>
                        <span
                          className={`font-medium ${q.textAnswer ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {q.textAnswer || "—"}
                        </span>
                      </div>
                      {q.expectedTextAnswer && (
                        <div>
                          <span className="text-xs text-muted-foreground">Expected: </span>
                          <span className="font-medium text-green-700 dark:text-green-400">
                            {q.expectedTextAnswer}
                          </span>
                        </div>
                      )}
                      {q.gradingStatus === "pending" && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-400">
                          This question is pending manual grading.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Link
          href={`/exam/${slug}`}
          className="block w-full text-center rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          ← Back to Exam
        </Link>
      </div>
    </div>
  );
}
