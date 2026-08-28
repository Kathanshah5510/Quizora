"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface AIGradingData {
  aiScore: number;
  aiRationale: string;
  aiModel: string;
  adminApprovedScore: number | null;
  status: string; // PENDING_REVIEW | APPROVED | REJECTED
}

interface Props {
  examId: string;
  attemptId: string;
  responseId: string;
  maxMarks: number;
  aiGrading: AIGradingData | null;
}

export default function AIGradeControls({
  examId,
  attemptId,
  responseId,
  maxMarks,
  aiGrading: initialAiGrading,
}: Props) {
  const [aiGrading, setAiGrading] = useState<AIGradingData | null>(initialAiGrading);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideScore, setOverrideScore] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const baseUrl = `/api/admin/exams/${examId}/attempts/${attemptId}/responses/${responseId}/ai-grade`;

  async function handleGetAIGrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(baseUrl, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI grading failed");
        return;
      }
      setAiGrading({
        aiScore: data.suggestedScore,
        aiRationale: data.rationale,
        aiModel: data.model,
        adminApprovedScore: null,
        status: "PENDING_REVIEW",
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: "approve" | "reject" | "override") {
    setError(null);
    const body: Record<string, unknown> = { action };
    if (action === "override") {
      const num = parseFloat(overrideScore);
      if (isNaN(num) || num < 0 || num > maxMarks) {
        setError(`Enter a value between 0 and ${maxMarks}`);
        return;
      }
      body.score = num;
    }

    const res = await fetch(baseUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      return;
    }

    if (action === "reject") {
      setAiGrading((prev) => prev ? { ...prev, status: "REJECTED" } : null);
    } else {
      const approved = action === "override" ? parseFloat(overrideScore) : aiGrading?.aiScore ?? 0;
      setAiGrading((prev) =>
        prev ? { ...prev, status: "APPROVED", adminApprovedScore: approved } : null
      );
      // Refresh so GradeResponseForm reflects the applied score
      startTransition(() => router.refresh());
    }
    setShowOverride(false);
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Grading</p>
        {(!aiGrading || aiGrading.status === "REJECTED") && (
          <button
            onClick={handleGetAIGrade}
            disabled={loading}
            className="rounded-md bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {loading ? "Getting AI Grade…" : aiGrading?.status === "REJECTED" ? "Re-run AI Grade" : "Get AI Grade"}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {aiGrading && aiGrading.status !== "REJECTED" && (
        <div className="space-y-2">
          {/* Suggestion */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                Suggested:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {aiGrading.aiScore.toFixed(2)} / {maxMarks}
                </span>
                {" · "}
                <span className="text-muted-foreground">{aiGrading.aiModel}</span>
              </p>
              {aiGrading.aiRationale && (
                <p className="text-xs text-muted-foreground mt-1 italic">{aiGrading.aiRationale}</p>
              )}
            </div>
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                aiGrading.status === "APPROVED"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}
            >
              {aiGrading.status === "APPROVED" ? "Approved" : "Pending review"}
            </span>
          </div>

          {/* Approved score */}
          {aiGrading.status === "APPROVED" && aiGrading.adminApprovedScore != null && (
            <p className="text-xs text-green-700 dark:text-green-400">
              Applied score: {aiGrading.adminApprovedScore.toFixed(2)} / {maxMarks}
            </p>
          )}

          {/* Action buttons — only when pending */}
          {aiGrading.status === "PENDING_REVIEW" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleAction("approve")}
                disabled={isPending}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Approve ({aiGrading.aiScore.toFixed(2)})
              </button>
              <button
                onClick={() => setShowOverride((v) => !v)}
                className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                Override
              </button>
              <button
                onClick={() => handleAction("reject")}
                disabled={isPending}
                className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}

          {/* Override input */}
          {showOverride && aiGrading.status === "PENDING_REVIEW" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min={0}
                max={maxMarks}
                value={overrideScore}
                onChange={(e) => setOverrideScore(e.target.value)}
                placeholder="0"
                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">/ {maxMarks}</span>
              <button
                onClick={() => handleAction("override")}
                disabled={isPending}
                className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Apply Override
              </button>
            </div>
          )}
        </div>
      )}

      {aiGrading?.status === "REJECTED" && (
        <p className="text-xs text-muted-foreground italic">AI suggestion was rejected. Grade manually below.</p>
      )}
    </div>
  );
}
