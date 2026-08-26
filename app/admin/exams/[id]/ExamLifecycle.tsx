"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  publishExamAction,
  unpublishExamAction,
  closeExamAction,
  reopenExamAction,
} from "../actions";
import { describeAvailability } from "@/lib/services/exam-lifecycle";

type Props = {
  examId: string;
  status: string;
  hasAttempts: boolean;
  availabilityStart: string | null;
  availabilityEnd: string | null;
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  PUBLISHED: { label: "Published", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ACTIVE: { label: "Active", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  CLOSED: { label: "Closed", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

export default function ExamLifecycle({
  examId,
  status,
  hasAttempts,
  availabilityStart,
  availabilityEnd,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const s = STATUS_MAP[status] ?? STATUS_MAP.DRAFT;
  const avStart = availabilityStart ? new Date(availabilityStart) : null;
  const avEnd = availabilityEnd ? new Date(availabilityEnd) : null;
  const { message: statusMsg, warning } = describeAvailability(status, avStart, avEnd);

  async function act(
    fn: (id: string) => Promise<{ error?: string; success?: boolean }>
  ) {
    setError(null);
    startTransition(async () => {
      const result = await fn(examId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>
            {s.label}
          </span>
          <p className={`text-sm ${warning ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
            {statusMsg}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" && (
            <LifecycleButton
              onClick={() => act(publishExamAction)}
              disabled={pending}
              variant="primary"
            >
              Publish
            </LifecycleButton>
          )}

          {status === "PUBLISHED" && (
            <>
              {!hasAttempts && (
                <LifecycleButton
                  onClick={() => act(unpublishExamAction)}
                  disabled={pending}
                  variant="secondary"
                >
                  Unpublish
                </LifecycleButton>
              )}
              <LifecycleButton
                onClick={() => act(closeExamAction)}
                disabled={pending}
                variant="danger"
              >
                Close Exam
              </LifecycleButton>
            </>
          )}

          {status === "ACTIVE" && (
            <LifecycleButton
              onClick={() => act(closeExamAction)}
              disabled={pending}
              variant="danger"
            >
              Close Exam
            </LifecycleButton>
          )}

          {status === "CLOSED" && (
            <LifecycleButton
              onClick={() => act(reopenExamAction)}
              disabled={pending}
              variant="secondary"
            >
              Reopen
            </LifecycleButton>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {warning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          The availability window has ended. Close the exam to prevent unintended access.
        </div>
      )}

      {pending && (
        <p className="text-xs text-muted-foreground">Updating…</p>
      )}
    </div>
  );
}

function LifecycleButton({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  variant: "primary" | "secondary" | "danger";
  children: React.ReactNode;
}) {
  const cls = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "border border-border text-foreground hover:bg-muted",
    danger: "border border-destructive/30 text-destructive hover:bg-destructive/10",
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}
