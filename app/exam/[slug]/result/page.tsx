"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ResultData {
  visible: true;
  examTitle: string;
  studentName: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  totalScore: number;
  maxScore: number;
  percentage: number | null;
  gradingStatus: string;
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
    const raw = sessionStorage.getItem(`quizora_session_${slug}`);
    if (!raw) {
      setError("No exam session found. Please start the exam first.");
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

  const { examTitle, studentName, studentId, totalScore, maxScore, percentage, gradingStatus } = data;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
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
        </div>

        {/* Submission timestamps */}
        {data.submittedAt && (
          <p className="text-center text-xs text-muted-foreground">
            Submitted{" "}
            {new Date(data.submittedAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
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
