import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Event Timeline" };

const EVENT_CONFIG: Record<string, { label: string; icon: string; cls: string }> = {
  STARTED:             { label: "Exam Started",        icon: "▶",  cls: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
  RECONNECTED:         { label: "Reconnected",         icon: "↺",  cls: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" },
  DEVICE_CHANGED:      { label: "Device Changed",      icon: "⚠",  cls: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" },
  TAB_SWITCHED:        { label: "Tab Switched",        icon: "⚑",  cls: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" },
  VISIBILITY_CHANGED:  { label: "Visibility Changed",  icon: "◉",  cls: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" },
  FULLSCREEN_EXITED:   { label: "Exited Full Screen",  icon: "⊡",  cls: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" },
  REFRESHED:           { label: "Page Refreshed",      icon: "⟳",  cls: "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800" },
  HEARTBEAT_MISSED:    { label: "Heartbeat Missed",    icon: "✕",  cls: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" },
  AUTO_SUBMITTED:      { label: "Auto-Submitted",      icon: "⚡", cls: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" },
  MANUALLY_SUBMITTED:  { label: "Manually Submitted",  icon: "✓",  cls: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
  TIMER_EXPIRED:       { label: "Timer Expired",       icon: "⏱",  cls: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" },
  WARNING_ISSUED:      { label: "Warning Issued",      icon: "⚠",  cls: "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800" },
};

interface Props {
  params: Promise<{ id: string; attemptId: string }>;
}

export default async function EventTimelinePage({ params }: Props) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId, attemptId } = await params;

  const attempt = await db.examAttempt.findFirst({
    where: { id: attemptId, examId },
    select: {
      id: true,
      studentId: true,
      studentName: true,
      studentEmail: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      tabViolations: true,
      ipAddress: true,
      userAgent: true,
      exam: { select: { title: true, course: { select: { code: true } } } },
    },
  });
  if (!attempt) notFound();

  const events = await db.examEvent.findMany({
    where: { attemptId },
    orderBy: { recordedAt: "asc" },
    select: {
      id: true,
      eventType: true,
      metadata: true,
      recordedAt: true,
    },
  });

  const durationMs = attempt.submittedAt
    ? attempt.submittedAt.getTime() - attempt.startedAt.getTime()
    : null;

  function fmt(d: Date) {
    return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" });
  }

  function elapsed(d: Date) {
    const ms = d.getTime() - attempt!.startedAt.getTime();
    if (ms < 0) return "before start";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `+${m}m ${sec}s` : `+${sec}s`;
  }

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
        <h1 className="text-xl font-bold text-foreground mt-1">Event Timeline</h1>
      </div>

      {/* Attempt summary */}
      <div className="rounded-xl border border-border bg-card px-6 py-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Student</p>
          <p className="font-medium text-foreground mt-0.5">{attempt.studentName}</p>
          <p className="text-xs text-muted-foreground font-mono">{attempt.studentId}</p>
          <p className="text-xs text-muted-foreground">{attempt.studentEmail}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Exam</p>
          <p className="font-medium text-foreground mt-0.5">{attempt.exam.title}</p>
          <p className="text-xs text-muted-foreground">{attempt.exam.course.code}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className="font-medium text-foreground mt-0.5 capitalize">{attempt.status.toLowerCase().replace("_", " ")}</p>
          {attempt.tabViolations > 0 && (
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              {attempt.tabViolations} tab violation{attempt.tabViolations !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Started</p>
          <p className="text-sm text-foreground mt-0.5">{fmt(attempt.startedAt)}</p>
        </div>
        {attempt.submittedAt && (
          <div>
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="text-sm text-foreground mt-0.5">{fmt(attempt.submittedAt)}</p>
          </div>
        )}
        {durationMs !== null && (
          <div>
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="text-sm text-foreground mt-0.5">{Math.round(durationMs / 60000)} min</p>
          </div>
        )}
        {attempt.ipAddress && (
          <div>
            <p className="text-xs text-muted-foreground">IP Address</p>
            <p className="text-sm font-mono text-foreground mt-0.5">{attempt.ipAddress}</p>
          </div>
        )}
        {attempt.userAgent && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs text-muted-foreground">User Agent</p>
            <p className="text-xs text-muted-foreground mt-0.5 break-all">{attempt.userAgent}</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Event Log{" "}
            <span className="text-muted-foreground font-normal">({events.length} event{events.length !== 1 ? "s" : ""})</span>
          </h2>
        </div>

        {events.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
            No events recorded for this attempt.
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-4 bottom-4 w-px bg-border" />

            <div className="space-y-2">
              {events.map((e, idx) => {
                const cfg = EVENT_CONFIG[e.eventType] ?? {
                  label: e.eventType,
                  icon: "•",
                  cls: "text-muted-foreground bg-muted border-border",
                };
                const ts = new Date(e.recordedAt);
                const meta = e.metadata as Record<string, unknown> | null;

                return (
                  <div key={e.id} className="flex gap-4 items-start">
                    {/* Icon circle */}
                    <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border text-sm font-bold shrink-0 ${cfg.cls}`}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 rounded-xl border px-4 py-3 ${cfg.cls}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-semibold">{cfg.label}</p>
                          {meta && Object.keys(meta).length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {Object.entries(meta).map(([k, v]) => (
                                <p key={k} className="text-xs">
                                  <span className="font-medium">{k}:</span>{" "}
                                  <span>{String(v)}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono">{elapsed(ts)}</p>
                          <p className="text-xs opacity-70">{ts.toLocaleTimeString("en-IN")}</p>
                          {idx === 0 && (
                            <p className="text-xs opacity-50">event {idx + 1}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
