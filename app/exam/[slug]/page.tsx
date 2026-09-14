import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { checkExamAccess, ExamAccessStatus } from "@/lib/exam/examAccess";
import ThemeToggle from "@/components/ThemeToggle";
import { APP_TIME_ZONE } from "@/lib/datetime";

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
    timeZone: APP_TIME_ZONE,
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
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Subtle mesh blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="blob1 absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, oklch(0.51 0.22 264), transparent 70%)" }}
        />
        <div
          className="blob2 absolute top-1/2 -right-40 w-[400px] h-[400px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.22 295), transparent 70%)" }}
        />
      </div>

      {/* Header */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Gradient Q logo */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{
                background: "linear-gradient(135deg, oklch(0.51 0.22 264), oklch(0.55 0.22 295))",
                boxShadow: "0 0 12px oklch(0.51 0.22 264 / 0.4)",
              }}
            >
              Q
            </div>
            <span className="font-bold text-foreground">Quizora</span>
            <span className="text-border">·</span>
            <span className="text-sm text-muted-foreground font-mono">{exam.course.code}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {/* Exam title & course */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {exam.course.code} — {exam.course.name}
          </p>
          <h1 className="text-3xl font-extrabold leading-tight" style={{ letterSpacing: "-0.02em" }}>
            {exam.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {exam.instructorName}
            {exam.taNames.length > 0 && ` · TA: ${exam.taNames.join(", ")}`}
          </p>
        </div>

        {/* Description/Instructions */}
        {exam.description && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-2">Instructions</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {exam.description}
            </p>
          </div>
        )}

        {/* Exam info grid */}
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          <InfoRow label="Questions" value={`${exam._count.questions} question${exam._count.questions !== 1 ? "s" : ""}`} />
          <InfoRow label="Duration" value={formatDuration(exam.durationMinutes)} />
          <InfoRow label="Timer" value={TIMER_MODE_LABELS[exam.timerMode] ?? exam.timerMode} />
          {exam.timerMode === "PER_QUESTION" && exam.perQuestionSeconds && (
            <InfoRow label="Time per question" value={`${exam.perQuestionSeconds} sec`} />
          )}
          {exam.attemptsAllowed > 1 && (
            <InfoRow label="Attempts allowed" value={String(exam.attemptsAllowed)} />
          )}
          {exam.availabilityStart && (
            <InfoRow label="Opens" value={formatDateTime(exam.availabilityStart)} />
          )}
          {exam.availabilityEnd && (
            <InfoRow label="Closes" value={formatDateTime(exam.availabilityEnd)} />
          )}
        </div>

        {/* Rules */}
        <div
          className="rounded-xl border p-5 space-y-3"
          style={{
            borderColor: "oklch(0.82 0.08 80 / 0.6)",
            background: "oklch(0.97 0.02 80 / 0.4)",
          }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "oklch(0.45 0.12 80)" }}>
            Exam Rules
          </h2>
          <ul className="text-sm space-y-1.5 list-none">
            {[
              "Do not switch tabs or windows during the exam.",
              "Copying, pasting, and right-clicking are disabled.",
              ...(exam.fullScreenRequired ? ["Fullscreen mode is required throughout."] : []),
              ...(!exam.allowBacktracking ? ["You cannot go back to a previous question once you proceed."] : []),
              "Submitting is final — you cannot modify answers after submission.",
              ...(exam.attemptsAllowed === 1 ? ["Only one attempt is allowed per student."] : []),
            ].map((rule) => (
              <li key={rule} className="flex items-start gap-2" style={{ color: "oklch(0.42 0.10 80)" }}>
                <span className="mt-0.5 shrink-0 text-xs">›</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-lg mx-auto">
          By starting this exam you confirm that your submission will be your own work.
          Any breach of academic integrity may result in disqualification.
        </p>

        {/* CTA */}
        {canStart ? (
          <div className="flex justify-center pt-2">
            <Link
              href={`/exam/${slug}/start`}
              className="btn-primary inline-flex items-center justify-center rounded-xl px-10 py-3.5 text-base font-bold"
            >
              Start Exam →
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
    <div className="flex justify-between items-center px-5 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-xs">{value}</span>
    </div>
  );
}
