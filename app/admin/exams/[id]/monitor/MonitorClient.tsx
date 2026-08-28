"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface AttemptRow {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  lastActiveAt: string;
  tabViolations: number;
  submissionId: string | null;
}

interface RecentEvent {
  id: string;
  eventType: string;
  metadata: unknown;
  recordedAt: string;
  studentName: string;
  studentId: string;
  attemptId: string;
}

interface MonitorData {
  exam: {
    id: string;
    title: string;
    status: string;
    courseCode: string;
    durationMinutes: number;
    availabilityStart: string | null;
    availabilityEnd: string | null;
  };
  stats: {
    enrolled: number;
    totalAttempts: number;
    inProgress: number;
    submitted: number;
    expired: number;
    abandoned: number;
    flagged: number;
    notStarted: number;
  };
  attempts: AttemptRow[];
  recentEvents: RecentEvent[];
  generatedAt: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  IN_PROGRESS: { label: "In Progress", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  SUBMITTED: { label: "Submitted", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  EXPIRED: { label: "Expired", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  ABANDONED: { label: "Abandoned", cls: "bg-muted text-muted-foreground" },
};

const EVENT_LABELS: Record<string, string> = {
  STARTED: "Started",
  RECONNECTED: "Reconnected",
  DEVICE_CHANGED: "Device Changed",
  TAB_SWITCHED: "Tab Switched",
  VISIBILITY_CHANGED: "Visibility Changed",
  FULLSCREEN_EXITED: "Exited Full Screen",
  REFRESHED: "Refreshed Page",
  HEARTBEAT_MISSED: "Heartbeat Missed",
  AUTO_SUBMITTED: "Auto-Submitted",
  MANUALLY_SUBMITTED: "Submitted",
  TIMER_EXPIRED: "Timer Expired",
  WARNING_ISSUED: "Warning Issued",
};

const INTEGRITY_EVENTS = new Set([
  "TAB_SWITCHED",
  "VISIBILITY_CHANGED",
  "FULLSCREEN_EXITED",
  "DEVICE_CHANGED",
  "AUTO_SUBMITTED",
  "WARNING_ISSUED",
  "HEARTBEAT_MISSED",
]);

function timeSince(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface Props {
  examId: string;
  initialData: MonitorData;
}

export default function MonitorClient({ examId, initialData }: Props) {
  const [data, setData] = useState<MonitorData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(30);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/monitor`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load monitor data");
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setCountdown(30);
    } catch {
      setError("Failed to refresh. Data may be stale.");
    } finally {
      setLoading(false);
    }
  }, [examId]);

  // Countdown timer + auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          refresh();
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const { stats, attempts, recentEvents, exam } = data;

  const flaggedAttempts = attempts.filter((a) => a.tabViolations > 0);
  const inProgressAttempts = attempts.filter((a) => a.status === "IN_PROGRESS");

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href={`/admin/exams/${examId}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {exam.title}
          </Link>
          <h1 className="text-xl font-bold text-foreground mt-1">Live Monitor</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {exam.courseCode} · {exam.status}
            {exam.durationMinutes && ` · ${exam.durationMinutes} min`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Refreshing in {countdown}s
          </p>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh Now"}
          </button>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Enrolled" value={stats.enrolled} />
        <StatCard label="Not Started" value={stats.notStarted} />
        <StatCard label="In Progress" value={stats.inProgress} highlight={stats.inProgress > 0 ? "blue" : undefined} />
        <StatCard label="Submitted" value={stats.submitted} highlight={stats.submitted > 0 ? "green" : undefined} />
        <StatCard label="Expired" value={stats.expired} highlight={stats.expired > 0 ? "orange" : undefined} />
        <StatCard label="Abandoned" value={stats.abandoned} />
        <StatCard label="Flagged" value={stats.flagged} highlight={stats.flagged > 0 ? "red" : undefined} />
      </div>

      {/* Flagged attempts */}
      {flaggedAttempts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
            Flagged Attempts ({flaggedAttempts.length})
          </h2>
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-red-200 dark:border-red-800">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Student</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">ID</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Tab Violations</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Last Active</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-200 dark:divide-red-800">
                  {flaggedAttempts.map((a) => {
                    const s = STATUS_MAP[a.status] ?? STATUS_MAP.ABANDONED;
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-2.5 font-medium text-foreground">{a.studentName}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.studentId}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="font-bold text-red-700 dark:text-red-400">{a.tabViolations}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{timeSince(a.lastActiveAt)}</td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/admin/exams/${examId}/results/${a.id}/events`}
                            className="text-xs text-primary hover:underline"
                          >
                            View Events →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* In-progress attempts */}
      {inProgressAttempts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            In Progress ({inProgressAttempts.length})
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Student</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Started</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Last Active</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Flags</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inProgressAttempts.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{a.studentName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground hidden sm:table-cell">{a.studentId}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatTime(a.startedAt)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{timeSince(a.lastActiveAt)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {a.tabViolations > 0 ? (
                          <span className="font-bold text-red-700 dark:text-red-400 text-xs">{a.tabViolations}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/exams/${examId}/results/${a.id}/events`}
                          className="text-xs text-primary hover:underline"
                        >
                          Events →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* All attempts */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          All Attempts ({attempts.length})
        </h2>
        {attempts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
            No attempts yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Student</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Started</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden lg:table-cell">Submitted</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Flags</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attempts.map((a) => {
                    const s = STATUS_MAP[a.status] ?? STATUS_MAP.ABANDONED;
                    const isTerminal = a.status === "SUBMITTED" || a.status === "EXPIRED";
                    return (
                      <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-foreground leading-tight">{a.studentName}</p>
                          <p className="text-xs text-muted-foreground">{a.studentEmail}</p>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground hidden md:table-cell">{a.studentId}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{formatTime(a.startedAt)}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                          {a.submittedAt ? formatTime(a.submittedAt) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {a.tabViolations > 0 ? (
                            <span className="font-bold text-red-700 dark:text-red-400 text-xs">{a.tabViolations}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {isTerminal && (
                              <Link
                                href={`/admin/exams/${examId}/results/${a.id}`}
                                className="text-xs text-primary hover:underline whitespace-nowrap"
                              >
                                Review →
                              </Link>
                            )}
                            <Link
                              href={`/admin/exams/${examId}/results/${a.id}/events`}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline whitespace-nowrap"
                            >
                              Events
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Recent event feed */}
      {recentEvents.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Activity
          </h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {recentEvents.map((e) => {
              const isIntegrity = INTEGRITY_EVENTS.has(e.eventType);
              return (
                <div key={e.id} className="px-4 py-2.5 flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${isIntegrity ? "bg-red-500" : "bg-green-500"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {e.studentName}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{e.studentId}</span>
                      <span className={`text-xs font-medium ${isIntegrity ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>
                        {EVENT_LABELS[e.eventType] ?? e.eventType}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{formatTime(e.recordedAt)}</p>
                    <Link
                      href={`/admin/exams/${examId}/results/${e.attemptId}/events`}
                      className="text-xs text-muted-foreground hover:text-primary hover:underline"
                    >
                      view →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            Last updated: {lastRefresh.toLocaleTimeString("en-IN")}
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: "blue" | "green" | "orange" | "red" }) {
  const cls =
    highlight === "red"
      ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
      : highlight === "blue"
      ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10"
      : highlight === "green"
      ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10"
      : highlight === "orange"
      ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10"
      : "border-border bg-card";

  const valCls =
    highlight === "red"
      ? "text-red-700 dark:text-red-400"
      : highlight === "blue"
      ? "text-blue-700 dark:text-blue-400"
      : highlight === "green"
      ? "text-green-700 dark:text-green-400"
      : highlight === "orange"
      ? "text-orange-700 dark:text-orange-400"
      : "text-foreground";

  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${valCls}`}>{value}</p>
    </div>
  );
}
