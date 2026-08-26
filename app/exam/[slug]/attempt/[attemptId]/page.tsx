"use client";

import { useState, useEffect, useCallback, useRef, useTransition, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useExamGuard } from "@/components/exam/useExamGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionOption {
  id: string;
  text: string;
  mediaUrl: string | null;
}

interface Question {
  id: string;
  type: string;
  text: string;
  marks: number;
  negativeMarks: number;
  mediaUrl: string | null;
  options: QuestionOption[];
}

interface SavedResponse {
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  numericalAnswer: number | null;
}

interface QuestionPayload {
  question: Question;
  index: number;
  totalQuestions: number;
  allowBacktracking: boolean;
  remainingSeconds: number;
  timerMode: string;
  perQuestionSeconds: number | null;
  savedResponse: SavedResponse | null;
}

// ─── Timer display ────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-1/2" />
      <div className="space-y-2 mt-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}

// ─── Question renderer ────────────────────────────────────────────────────────

function QuestionView({
  payload,
  onAnswer,
  isPending,
}: {
  payload: QuestionPayload;
  onAnswer: (answer: Partial<SavedResponse>) => void;
  isPending: boolean;
}) {
  const { question, savedResponse } = payload;
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => (savedResponse?.selectedOptionIds as string[]) ?? []
  );
  const [textVal, setTextVal] = useState(savedResponse?.textAnswer ?? "");
  const [numVal, setNumVal] = useState(
    savedResponse?.numericalAnswer !== null && savedResponse?.numericalAnswer !== undefined
      ? String(savedResponse.numericalAnswer)
      : ""
  );

  // Sync when question changes
  useEffect(() => {
    setSelectedIds((savedResponse?.selectedOptionIds as string[]) ?? []);
    setTextVal(savedResponse?.textAnswer ?? "");
    setNumVal(
      savedResponse?.numericalAnswer !== null && savedResponse?.numericalAnswer !== undefined
        ? String(savedResponse.numericalAnswer)
        : ""
    );
  }, [question.id, savedResponse]);

  const isMCQType =
    question.type === "MCQ" || question.type === "TRUE_FALSE" || question.type === "IMAGE_BASED";
  const isMSQ = question.type === "MSQ";
  const isText = question.type === "SHORT_TEXT";
  const isNumerical = question.type === "NUMERICAL";

  const handleOptionClick = (optId: string) => {
    if (isPending) return;
    if (isMCQType) {
      const next = selectedIds[0] === optId ? [] : [optId];
      setSelectedIds(next);
      onAnswer({ selectedOptionIds: next });
    } else if (isMSQ) {
      const next = selectedIds.includes(optId)
        ? selectedIds.filter((id) => id !== optId)
        : [...selectedIds, optId];
      setSelectedIds(next);
      onAnswer({ selectedOptionIds: next });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-base leading-relaxed flex-1">{question.text}</p>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {question.marks} mark{question.marks !== 1 ? "s" : ""}
          {question.negativeMarks > 0 && ` | −${question.negativeMarks} wrong`}
        </span>
      </div>

      {question.mediaUrl && (
        <img
          src={question.mediaUrl}
          alt="Question illustration"
          className="max-w-full rounded border"
          loading="lazy"
        />
      )}

      {(isMCQType || isMSQ) && (
        <ul className="space-y-2" role="group" aria-label="Answer options">
          {question.options.map((opt) => {
            const selected = selectedIds.includes(opt.id);
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => handleOptionClick(opt.id)}
                  disabled={isPending}
                  aria-pressed={selected}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
                    selected
                      ? "bg-primary/10 border-primary text-primary font-medium"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {opt.text}
                  {opt.mediaUrl && (
                    <img src={opt.mediaUrl} alt="" className="mt-2 max-h-24 rounded" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {isText && (
        <textarea
          aria-label="Your answer"
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          onBlur={() => onAnswer({ textAnswer: textVal.trim() || null })}
          disabled={isPending}
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          placeholder="Type your answer here…"
        />
      )}

      {isNumerical && (
        <input
          type="number"
          aria-label="Numerical answer"
          value={numVal}
          onChange={(e) => setNumVal(e.target.value)}
          onBlur={() => {
            const n = parseFloat(numVal);
            onAnswer({ numericalAnswer: isNaN(n) ? null : n });
          }}
          disabled={isPending}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          placeholder="Enter a number"
          step="any"
        />
      )}
    </div>
  );
}

// ─── Main exam session ────────────────────────────────────────────────────────

function ExamSessionInner() {
  const params = useParams<{ slug: string; attemptId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const slug = params.slug;
  const attemptId = params.attemptId;
  const sessionToken = searchParams.get("sessionToken") ?? "";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [payload, setPayload] = useState<QuestionPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [allowBacktracking, setAllowBacktracking] = useState(true);
  const [fullScreenRequired, setFullScreenRequired] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [tabViolations, setTabViolations] = useState(0);
  const [violationWarning, setViolationWarning] = useState(false);
  const [isPending, startTransition] = useTransition();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load a question by index
  const loadQuestion = useCallback(
    async (index: number) => {
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/exam/${slug}/question?attemptId=${attemptId}&sessionToken=${encodeURIComponent(sessionToken)}&index=${index}`
        );
        const data = await res.json();

        if (!res.ok) {
          if (data.status === "EXPIRED" || data.status === "SUBMITTED") {
            setSubmitted(true);
            return;
          }
          setLoadError(data.error ?? "Failed to load question.");
          return;
        }

        setPayload(data);
        setRemainingSeconds(data.remainingSeconds);
        setTotalQuestions(data.totalQuestions);
        setAllowBacktracking(data.allowBacktracking);
        setCurrentIndex(index);
      } catch {
        setLoadError("Network error. Please check your connection.");
      }
    },
    [slug, attemptId, sessionToken]
  );

  // Initial load + check fullScreen from search params or exam info
  useEffect(() => {
    loadQuestion(0);
  }, [loadQuestion]);

  // Countdown timer (client-side display only; server is authoritative)
  useEffect(() => {
    if (submitted) return;
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Timer hit 0 — trigger auto-submit
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync timer from server every 30 seconds
  useEffect(() => {
    if (submitted) return;
    const syncTimer = async () => {
      try {
        const res = await fetch(
          `/api/exam/${slug}/timer?attemptId=${attemptId}&sessionToken=${encodeURIComponent(sessionToken)}`
        );
        const data = await res.json();
        if (data.isExpired || data.status === "EXPIRED") {
          setSubmitted(true);
        } else {
          setRemainingSeconds(data.remainingSeconds);
        }
      } catch {
        // Ignore network errors on timer sync
      }
    };
    const interval = setInterval(syncTimer, 30000);
    return () => clearInterval(interval);
  }, [slug, attemptId, sessionToken, submitted]);

  const handleAutoSubmit = useCallback(async () => {
    if (submitted) return;
    setSubmitted(true);
    await fetch(`/api/exam/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, sessionToken }),
    });
  }, [slug, attemptId, sessionToken, submitted]);

  // Report event to server
  const reportEvent = useCallback(
    async (eventType: string, metadata?: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/exam/${slug}/event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, sessionToken, eventType, metadata }),
        });
        const data = await res.json();
        if (data.autoSubmitted) {
          setSubmitted(true);
        } else if (data.tabViolations !== undefined) {
          setTabViolations(data.tabViolations);
          setViolationWarning(true);
          setTimeout(() => setViolationWarning(false), 5000);
        }
      } catch {
        // Offline — violation still tracked on reconnect via event log
      }
    },
    [slug, attemptId, sessionToken]
  );

  // Exam guard (copy/paste/tab/fullscreen deterrents)
  useExamGuard({
    fullScreenRequired,
    disabled: submitted,
    onTabSwitch: () => reportEvent("TAB_SWITCHED"),
    onFullscreenExit: () => reportEvent("FULLSCREEN_EXITED"),
    onViolation: (type) => reportEvent(type),
  });

  // Save answer
  const handleAnswer = useCallback(
    (answer: Partial<{ selectedOptionIds: string[] | null; textAnswer: string | null; numericalAnswer: number | null }>) => {
      if (!payload || submitted) return;
      startTransition(async () => {
        try {
          await fetch(`/api/exam/${slug}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId,
              sessionToken,
              questionId: payload.question.id,
              ...answer,
            }),
          });
        } catch {
          // Offline tolerance: answer will be retried on next interaction
        }
      });
    },
    [payload, submitted, slug, attemptId, sessionToken]
  );

  // Navigate to question
  const navigateTo = useCallback(
    async (toIndex: number) => {
      if (isPending) return;
      const navRes = await fetch(`/api/exam/${slug}/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, sessionToken, fromIndex: currentIndex, toIndex }),
      });
      const navData = await navRes.json();
      if (!navRes.ok) {
        if (navData.code === "BACKWARD_NOT_ALLOWED") {
          // Silently ignore — UI should hide back button anyway
          return;
        }
        return;
      }
      await loadQuestion(toIndex);
    },
    [slug, attemptId, sessionToken, currentIndex, isPending, loadQuestion]
  );

  // Manual submit
  const handleSubmit = async () => {
    if (submitted) return;
    const res = await fetch(`/api/exam/${slug}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, sessionToken }),
    });
    const data = await res.json();
    if (res.ok) {
      setSubmitted(true);
      setSubmissionId(data.submissionId);
    }
  };

  // ── Submitted state ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold">Exam Submitted</h1>
          <p className="text-muted-foreground">
            Your responses have been recorded.
          </p>
          {submissionId && (
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">Submission ID</p>
              <p className="font-mono font-bold text-lg">{submissionId}</p>
              <p className="text-xs text-muted-foreground mt-1">Keep this for your records.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isLow = remainingSeconds > 0 && remainingSeconds <= 300; // ≤ 5 minutes = warning

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-card shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <span className="text-sm font-medium">
            Q{currentIndex + 1}/{totalQuestions}
          </span>

          {/* Tab violation warning */}
          {violationWarning && tabViolations > 0 && (
            <span
              role="alert"
              className="text-xs font-medium text-destructive"
            >
              ⚠️ Tab switch detected ({tabViolations}/2). Exam will auto-submit on next violation.
            </span>
          )}

          {/* Timer */}
          <div
            className={`font-mono font-bold text-base tabular-nums ${
              isLow ? "text-destructive animate-pulse" : ""
            }`}
            aria-label={`Time remaining: ${formatTime(remainingSeconds)}`}
            aria-live="off"
          >
            {formatTime(remainingSeconds)}
          </div>
        </div>
      </header>

      {/* Question area */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        {loadError ? (
          <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {loadError}
            <button
              onClick={() => loadQuestion(currentIndex)}
              className="ml-3 underline"
            >
              Retry
            </button>
          </div>
        ) : payload ? (
          <QuestionView payload={payload} onAnswer={handleAnswer} isPending={isPending} />
        ) : (
          <LoadingSkeleton />
        )}
      </main>

      {/* Navigation footer */}
      <footer className="sticky bottom-0 border-t bg-card">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigateTo(currentIndex - 1)}
            disabled={currentIndex === 0 || !allowBacktracking || isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Previous question"
          >
            ← Previous
          </button>

          {/* Progress dots (max 20 shown) */}
          <div className="flex gap-1 flex-wrap justify-center flex-1" role="navigation" aria-label="Question progress">
            {Array.from({ length: Math.min(totalQuestions, 20) }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => navigateTo(i)}
                disabled={!allowBacktracking && i < currentIndex || isPending}
                className={`w-2 h-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  i === currentIndex
                    ? "bg-primary"
                    : "bg-muted hover:bg-muted-foreground/40"
                }`}
                aria-label={`Question ${i + 1}${i === currentIndex ? " (current)" : ""}`}
                aria-current={i === currentIndex ? "true" : undefined}
              />
            ))}
          </div>

          {currentIndex < totalQuestions - 1 ? (
            <button
              type="button"
              onClick={() => navigateTo(currentIndex + 1)}
              disabled={isPending}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Next question"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-md bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Submit Exam
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function ExamSessionPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ExamSessionInner />
    </Suspense>
  );
}
