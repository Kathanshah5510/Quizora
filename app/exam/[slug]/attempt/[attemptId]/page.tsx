"use client";

import { useState, useEffect, useCallback, useRef, useTransition, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
  fullScreenRequired: boolean;
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
        <Image
          src={question.mediaUrl}
          alt="Question illustration"
          width={800}
          height={600}
          className="max-w-full h-auto rounded border"
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
                    <Image src={opt.mediaUrl} alt="" width={400} height={96} className="mt-2 max-h-24 w-auto rounded" />
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
  const router = useRouter();

  const slug = params.slug;
  const attemptId = params.attemptId;

  // Session token is stored in sessionStorage (never in the URL)
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionMissing, setSessionMissing] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [payload, setPayload] = useState<QuestionPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [timerReady, setTimerReady] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [allowBacktracking, setAllowBacktracking] = useState(false);
  const [timerMode, setTimerMode] = useState<string>("WHOLE_QUIZ");
  const [perQuestionSeconds, setPerQuestionSeconds] = useState<number | null>(null);
  const [perQuestionRemaining, setPerQuestionRemaining] = useState<number>(0);
  const [fullScreenRequired, setFullScreenRequired] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [tabViolations, setTabViolations] = useState(0);
  const [maxTabViolations, setMaxTabViolations] = useState(2);
  const [violationWarning, setViolationWarning] = useState(false);
  const [isPending, startTransition] = useTransition();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const perQTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read session token from sessionStorage on mount (never from URL)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`quizora_session_${slug}`);
      if (!raw) {
        setSessionMissing(true);
        return;
      }
      const data = JSON.parse(raw) as { attemptId?: string; sessionToken?: string };
      if (data.attemptId !== attemptId || !data.sessionToken) {
        setSessionMissing(true);
        return;
      }
      setSessionToken(data.sessionToken);
    } catch {
      setSessionMissing(true);
    }
  }, [slug, attemptId]);

  // Load a question by index — sessionToken sent via header, never in URL
  const loadQuestion = useCallback(
    async (index: number) => {
      if (!sessionToken) return;
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/exam/${slug}/question?attemptId=${attemptId}&index=${index}`,
          { headers: { "X-Session-Token": sessionToken } }
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
        setTimerReady(true);
        setTotalQuestions(data.totalQuestions);
        // PER_QUESTION mode: backtracking is never allowed
        setAllowBacktracking(data.timerMode === "PER_QUESTION" ? false : data.allowBacktracking);
        setTimerMode(data.timerMode);
        setPerQuestionSeconds(data.perQuestionSeconds ?? null);
        if (data.timerMode === "PER_QUESTION" && data.perQuestionSeconds) {
          setPerQuestionRemaining(data.perQuestionSeconds);
        }
        setFullScreenRequired(data.fullScreenRequired ?? false);
        setCurrentIndex(index);
      } catch {
        setLoadError("Network error. Please check your connection.");
      }
    },
    [slug, attemptId, sessionToken]
  );

  // Initial question load — fires when sessionToken is ready
  useEffect(() => {
    loadQuestion(0);
  }, [loadQuestion]);

  // Whole-quiz countdown — only active for WHOLE_QUIZ mode
  useEffect(() => {
    if (submitted || !timerReady || timerMode === "PER_QUESTION") return;
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [submitted, timerReady, timerMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-question countdown — resets when currentIndex changes
  useEffect(() => {
    if (submitted || timerMode !== "PER_QUESTION" || !perQuestionSeconds) return;
    clearInterval(perQTimerRef.current!);
    setPerQuestionRemaining(perQuestionSeconds);
    perQTimerRef.current = setInterval(() => {
      setPerQuestionRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(perQTimerRef.current!);
          // Auto-advance to next question or submit if last
          setTotalQuestions((total) => {
            setCurrentIndex((idx) => {
              if (idx < total - 1) {
                // Navigate to next question (deferred to avoid state-in-render)
                setTimeout(() => navigateTo(idx + 1), 0);
              } else {
                handleAutoSubmit();
              }
              return idx;
            });
            return total;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(perQTimerRef.current!);
  }, [submitted, timerMode, perQuestionSeconds, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync timer from server every 30 seconds — token via header
  useEffect(() => {
    if (submitted || !sessionToken) return;
    const syncTimer = async () => {
      try {
        const res = await fetch(
          `/api/exam/${slug}/timer?attemptId=${attemptId}`,
          { headers: { "X-Session-Token": sessionToken } }
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
    if (submitted || !sessionToken) return;
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
      if (!sessionToken) return;
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
          if (data.maxTabViolations !== undefined) setMaxTabViolations(data.maxTabViolations);
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
      if (!payload || submitted || !sessionToken) return;
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
    [payload, submitted, sessionToken, slug, attemptId]
  );

  // Navigate to question
  const navigateTo = useCallback(
    async (toIndex: number) => {
      if (isPending || !sessionToken) return;
      const navRes = await fetch(`/api/exam/${slug}/navigate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, sessionToken, fromIndex: currentIndex, toIndex }),
      });
      const navData = await navRes.json();
      if (!navRes.ok) {
        if (navData.code === "BACKWARD_NOT_ALLOWED") {
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
    if (submitted || !sessionToken) return;
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

  // ── Session missing ──────────────────────────────────────────────────────────
  if (sessionMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold">Session Not Found</h1>
          <p className="text-muted-foreground text-sm">
            Your exam session could not be restored. This can happen if you opened the exam in a new
            tab or browser. Please return to the start page and re-enter your details to reconnect.
          </p>
          <a
            href={`/exam/${slug}/start`}
            className="inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Return to Start
          </a>
        </div>
      </div>
    );
  }

  // ── Waiting for sessionStorage to resolve ────────────────────────────────────
  if (!sessionToken) {
    return <LoadingSkeleton />;
  }

  // ── Submitted state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-4">
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
          <Link
            href={`/exam/${slug}/result`}
            className="inline-block w-full rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View Your Results →
          </Link>
          <p className="text-xs text-muted-foreground">
            Results are shown once grading is complete and your instructor has released them.
          </p>
        </div>
      </div>
    );
  }

  const isPQ = timerMode === "PER_QUESTION";
  const displayTime = isPQ ? perQuestionRemaining : remainingSeconds;
  const isLow = isPQ
    ? displayTime > 0 && displayTime <= 10
    : displayTime > 0 && displayTime <= 300; // ≤ 5 min whole-quiz / ≤ 10 s per-question

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Tab violation overlay warning */}
      {violationWarning && tabViolations > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="mx-4 max-w-sm w-full rounded-xl border-2 border-destructive bg-card px-6 py-8 text-center shadow-2xl">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-destructive mb-2">Tab Switch Detected!</h2>
            <p className="text-sm text-foreground mb-1">
              You have left the exam window <strong>{tabViolations}</strong> time{tabViolations !== 1 ? "s" : ""}.
            </p>
            <p className="text-sm text-destructive font-medium">
              {tabViolations >= maxTabViolations
                ? "Your exam will be auto-submitted."
                : `Your exam will auto-submit after ${maxTabViolations} violations.`}
            </p>
            <p className="text-xs text-muted-foreground mt-3">This warning closes automatically.</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-card shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          <span className="text-sm font-medium">
            Q{currentIndex + 1}/{totalQuestions}
          </span>

          {/* Timer */}
          <div className="flex flex-col items-end">
            <div
              className={`font-mono font-bold text-base tabular-nums ${
                isLow ? "text-destructive animate-pulse" : ""
              }`}
              aria-label={`Time remaining: ${formatTime(displayTime)}`}
              aria-live="off"
            >
              {formatTime(displayTime)}
            </div>
            {isPQ && (
              <span className="text-[10px] text-muted-foreground leading-none">this question</span>
            )}
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
