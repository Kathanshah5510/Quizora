import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { checkExamAccess, ExamAccessStatus } from "@/lib/exam/examAccess";
import ThemeToggle from "@/components/ThemeToggle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exam = await db.exam.findUnique({
    where: { slug },
    select: { title: true, status: true },
  });
  if (!exam || exam.status === "DRAFT") return { title: "Exam Not Found" };
  return { title: exam.title };
}

const TIMER_MODE_LABELS: Record<string, string> = {
  WHOLE_QUIZ: "Single timer for the whole exam",
  PER_QUESTION: "Per-question time limit",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function formatDateTime(dt: Date): string {
  return dt.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AccessDeniedPage({ status }: { status: ExamAccessStatus }) {
  const messages: Record<string, { title: string; body: string }> = {
    CLOSED: {
      title: "Exam Closed",
      body: "This exam is no longer accepting submissions.",
    },
    NOT_YET_AVAILABLE: {
      title: "Not Yet Available",
      body: "This exam is not open yet. Please check the availability window and try again later.",
    },
    AVAILABILITY_ENDED: {
      title: "Availability Window Ended",
      body: "The availability window for this exam has passed.",
    },
  };

  const msg = messages[status] ?? {
    title: "Exam Unavailable",
    body: "This exam is not currently accessible.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h1 className="text-2xl font-bold">{msg.title}</h1>
        <p className="text-muted-foreground">{msg.body}</p>
      </div>
    </div>
  );
}

export default async function ExamLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const exam = await db.exam.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      instructorName: true,
      taNames: true,
      status: true,
      availabilityStart: true,
      availabilityEnd: true,
      durationMinutes: true,
      timerMode: true,
      perQuestionSeconds: true,
      attemptsAllowed: true,
      allowBacktracking: true,
      allowExternalStudents: true,
      fullScreenRequired: true,
      continueAfterAvailability: true,
      course: { select: { name: true, code: true } },
      _count: { select: { questions: true } },
    },
  });

  if (!exam || exam.status === "DRAFT") notFound();

  const now = new Date();
  const access = checkExamAccess(
    {
      status: exam.status,
      availabilityStart: exam.availabilityStart,
      availabilityEnd: exam.availabilityEnd,
      continueAfterAvailability: exam.continueAfterAvailability,
    },
    now
  );

  if (access !== "ACCESSIBLE") {
    return <AccessDeniedPage status={access} />;
  }

  const canStart = exam.status === "PUBLISHED" || exam.status === "ACTIVE";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-primary">Quizora</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{exam.course.code}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Exam title & course */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
            {exam.course.code} — {exam.course.name}
          </p>
          <h1 className="text-3xl font-bold">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">
            Instructor: {exam.instructorName}
            {exam.taNames.length > 0 && ` · TA: ${exam.taNames.join(", ")}`}
          </p>
        </div>

        {/* Description/Instructions */}
        {exam.description && (
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-semibold mb-2">Instructions</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {exam.description}
            </p>
          </div>
        )}

        {/* Exam info grid */}
        <div className="rounded-lg border bg-card divide-y">
          <InfoRow label="Questions" value={String(exam._count.questions)} />
          <InfoRow label="Duration" value={formatDuration(exam.durationMinutes)} />
          <InfoRow label="Timer" value={TIMER_MODE_LABELS[exam.timerMode] ?? exam.timerMode} />
          {exam.timerMode === "PER_QUESTION" && exam.perQuestionSeconds && (
            <InfoRow label="Time per question" value={`${exam.perQuestionSeconds} sec`} />
          )}
          {exam.availabilityStart && (
            <InfoRow label="Opens" value={formatDateTime(exam.availabilityStart)} />
          )}
          {exam.availabilityEnd && (
            <InfoRow label="Closes" value={formatDateTime(exam.availabilityEnd)} />
          )}
        </div>

        {/* Rules */}
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4 space-y-2">
          <h2 className="font-semibold text-amber-800 dark:text-amber-200">Exam Rules</h2>
          <ul className="text-sm text-amber-900 dark:text-amber-300 space-y-1 list-disc list-inside">
            <li>Do not switch tabs or windows during the exam.</li>
            <li>Copying, pasting, and right-clicking are disabled.</li>
            {exam.fullScreenRequired && <li>Fullscreen mode is required.</li>}
            {!exam.allowBacktracking && (
              <li>You cannot go back to a previous question once you proceed.</li>
            )}
            <li>Submitting is final — you cannot modify answers after submission.</li>
            {exam.attemptsAllowed === 1 && (
              <li>Only one attempt is allowed per student.</li>
            )}
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p>
            By starting this exam you confirm that your submission will be your own work. Any breach of
            academic integrity may result in disqualification.
          </p>
          <p>
            Results are released by your instructor after grading is complete.
          </p>
        </div>

        {/* CTA */}
        {canStart ? (
          <div className="flex justify-center pt-2">
            <Link
              href={`/exam/${slug}/start`}
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-8 py-3 text-base font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Start Exam
            </Link>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            This exam is not currently accepting new attempts.
          </p>
        )}
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-xs">{value}</span>
    </div>
  );
}
