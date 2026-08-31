"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading results…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="rounded-xl border border-border bg-card px-8 py-10 text-center max-w-md">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (!data.visible) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="rounded-xl border border-border bg-card px-8 py-10 text-center max-w-md space-y-3">
          <div className="text-4xl">📋</div>
          <h1 className="text-lg font-bold text-foreground">Exam Submitted</h1>
          <p className="text-sm text-muted-foreground">
            {REASON_MESSAGES[data.reason] ?? "Results are not yet available."}
          </p>
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

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">Your Result</h1>
          <p className="text-sm text-muted-foreground">{examTitle}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {studentName} · {studentId}
          </p>
        </div>

        {/* Score card */}
        <div className="rounded-2xl border border-border bg-card px-8 py-8 text-center space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Score</p>
            <p className="text-4xl font-bold text-foreground mt-1">
              {totalScore.toFixed(2)}
              <span className="text-xl font-normal text-muted-foreground"> / {maxScore.toFixed(2)}</span>
            </p>
          </div>

          {percentage != null && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Percentage</p>
              <p className="text-3xl font-bold text-primary mt-1">{percentage.toFixed(1)}%</p>
            </div>
          )}

          {gradingStatus === "PARTIAL" && (
            <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2">
              Some questions are still being reviewed. Your final score may change.
            </p>
          )}

          {submissionId && (
            <p className="text-xs text-muted-foreground font-mono">
              Submission ID: {submissionId}
            </p>
          )}

          {submittedAt && (
            <p className="text-xs text-muted-foreground">
              Submitted{" "}
              {new Date(submittedAt).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>

        {/* Correct answers note */}
        {!showAnswers && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            Correct answers will be visible after the exam availability window closes
            {availabilityEnd
              ? ` (${new Date(availabilityEnd).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}).`
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
                        <span className="text-xs font-medium text-muted-foreground">Q{idx + 1}</span>
                        <span className="text-xs rounded bg-muted px-1.5 py-0.5 font-mono">{q.type}</span>
                        {q.gradingStatus === "pending" && (
                          <span className="text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5">
                            Pending grading
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1">{q.text}</p>
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
                            <span className={`flex-1 ${selected ? "font-medium" : ""} ${correct ? "text-foreground" : "text-muted-foreground"}`}>
                              {opt.text}
                            </span>
                            {correct && (
                              <span className="text-xs text-green-700 dark:text-green-400 font-medium shrink-0">correct</span>
                            )}
                            {selected && !correct && (
                              <span className="text-xs text-red-700 dark:text-red-400 font-medium shrink-0">wrong</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* NUMERICAL */}
                  {q.type === "NUMERICAL" && (
                    <div className="pl-2 space-y-1 text-sm">
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <span className="text-xs text-muted-foreground">Your answer: </span>
                          <span className={`font-mono font-medium ${q.numericalAnswer != null ? "text-foreground" : "text-muted-foreground"}`}>
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
                        <span className={`font-medium ${q.textAnswer ? "text-foreground" : "text-muted-foreground"}`}>
                          {q.textAnswer || "—"}
                        </span>
                      </div>
                      {q.expectedTextAnswer && (
                        <div>
                          <span className="text-xs text-muted-foreground">Expected: </span>
                          <span className="font-medium text-green-700 dark:text-green-400">{q.expectedTextAnswer}</span>
                        </div>
                      )}
                      {q.gradingStatus === "pending" && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-400">This question is pending manual grading.</p>
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
          className="block w-full text-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Back to Exam
        </Link>
      </div>
    </div>
  );
}
