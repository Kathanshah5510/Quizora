"use client";

import { useState, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface FormState {
  name: string;
  studentId: string;
  email: string;
}

const SESSION_KEY = (slug: string) => `quizora_session_${slug}`;

function readStoredSession(slug: string): { sessionToken: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(slug));
    if (!raw) return null;
    const data = JSON.parse(raw) as { sessionToken?: string };
    return data.sessionToken ? { sessionToken: data.sessionToken } : null;
  } catch {
    return null;
  }
}

function writeStoredSession(slug: string, attemptId: string, sessionToken: string): void {
  const data = JSON.stringify({ attemptId, sessionToken });
  try {
    sessionStorage.setItem(SESSION_KEY(slug), data);
  } catch {
    // sessionStorage may be unavailable in some contexts; non-fatal
  }
  try {
    // Also persist in localStorage so results remain accessible after the tab is closed
    localStorage.setItem(SESSION_KEY(slug), data);
  } catch {
    // localStorage may be unavailable (private browsing, storage quota); non-fatal
  }
}

export default function ExamStartPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [form, setForm] = useState<FormState>({ name: "", studentId: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-fill email when studentId is 9 digits
  const handleStudentIdChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      studentId: value,
      email: /^\d{9}$/.test(value.trim()) ? `${value.trim()}@dau.ac.in` : prev.email,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      // Step 1: Validate identity + eligibility
      const validateRes = await fetch(`/api/exam/${slug}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const validateData = await validateRes.json();

      if (!validateRes.ok) {
        setError(validateData.error ?? "Validation failed.");
        return;
      }

      // Read stored session token — present if this browser tab had an active session
      const stored = readStoredSession(slug);

      // Step 2: Start or reconnect attempt
      const startRes = await fetch(`/api/exam/${slug}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          deviceFingerprint: navigator.userAgent,
          // resumeToken lets the server grant immediate reconnect for the same browser session
          ...(stored ? { resumeToken: stored.sessionToken } : {}),
        }),
      });
      const startData = await startRes.json();

      if (startRes.status === 409 && startData.code === "DEVICE_LOCKED") {
        setError(
          `${startData.error} Try again in ${startData.retryAfterSeconds} seconds.`
        );
        return;
      }

      if (!startRes.ok) {
        setError(startData.error ?? "Could not start exam.");
        return;
      }

      const { attemptId, sessionToken } = startData;

      // Persist session in sessionStorage so the attempt page and future reconnects can use it
      writeStoredSession(slug, attemptId, sessionToken);

      // Navigate to attempt — token is NOT in the URL (stored in sessionStorage only)
      router.push(`/exam/${slug}/attempt/${attemptId}`);
    });
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Subtle background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="blob1 absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, oklch(0.51 0.22 264), transparent 70%)" }}
        />
        <div
          className="blob3 absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.22 295), transparent 70%)" }}
        />
      </div>

      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href={`/exam/${slug}`} className="flex items-center gap-2.5 group">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{
                background: "linear-gradient(135deg, oklch(0.51 0.22 264), oklch(0.55 0.22 295))",
                boxShadow: "0 0 10px oklch(0.51 0.22 264 / 0.35)",
              }}
            >
              Q
            </div>
            <span className="font-bold text-foreground text-sm">Quizora</span>
          </Link>
          <Link
            href={`/exam/${slug}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold" style={{ letterSpacing: "-0.02em" }}>
              Enter Your Details
            </h1>
            <p className="text-sm text-muted-foreground">
              Verify your identity to begin the exam.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
                placeholder="e.g. Rahul Sharma"
                aria-required="true"
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="studentId" className="text-sm font-medium">
                Student ID{" "}
                <span className="text-muted-foreground font-normal">(9 digits)</span>
              </label>
              <input
                id="studentId"
                type="text"
                required
                inputMode="numeric"
                pattern="\d{9}"
                maxLength={9}
                value={form.studentId}
                onChange={(e) => handleStudentIdChange(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
                placeholder="202301001"
                aria-required="true"
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Institutional Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
                placeholder="202301001@dau.ac.in"
                aria-required="true"
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Must match <span className="font-mono">{"{studentId}@dau.ac.in"}</span>
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full rounded-xl py-3 text-sm font-bold mt-2"
            >
              {isPending ? "Verifying…" : "Verify & Start Exam →"}
            </button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            By starting, you agree to abide by the exam rules.
          </p>
        </div>
      </div>
    </div>
  );
}
