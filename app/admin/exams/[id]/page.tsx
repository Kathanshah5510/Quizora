import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import ExamForm from "@/components/admin/ExamForm";
import ExamLifecycle from "./ExamLifecycle";
import { updateExamAction } from "../actions";

export const metadata: Metadata = { title: "Exam Settings" };

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  PUBLISHED: { label: "Published", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ACTIVE: { label: "Active", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  CLOSED: { label: "Closed", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id } = await params;
  const exam = await db.exam.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, name: true, code: true } },
      _count: { select: { questions: true, attempts: true, roster: true } },
    },
  });

  if (!exam) notFound();

  const courses = await db.course.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, name: true, code: true },
  });

  const boundUpdateAction = updateExamAction.bind(null, exam.id);
  const s = STATUS_MAP[exam.status] ?? STATUS_MAP.DRAFT;
  const isLocked = ["ACTIVE", "CLOSED"].includes(exam.status);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/exams"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Exams
          </Link>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <h1 className="text-xl font-bold text-foreground leading-snug">{exam.title}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
              {s.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
            <Link href={`/admin/courses/${exam.course.id}`} className="font-mono hover:text-primary transition-colors">
              {exam.course.code}
            </Link>
            <span>{exam._count.questions} question{exam._count.questions !== 1 ? "s" : ""}</span>
            <span>{exam._count.roster} students on roster</span>
            <span>{exam._count.attempts} attempt{exam._count.attempts !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Lifecycle */}
      <ExamLifecycle
        examId={exam.id}
        status={exam.status}
        hasAttempts={exam._count.attempts > 0}
        availabilityStart={exam.availabilityStart?.toISOString() ?? null}
        availabilityEnd={exam.availabilityEnd?.toISOString() ?? null}
      />

      {isLocked && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          This exam is {exam.status.toLowerCase()} and cannot be edited.
        </div>
      )}

      {/* Settings form */}
      <ExamForm
        action={boundUpdateAction}
        courses={courses}
        defaultValues={{
          courseId: exam.courseId,
          title: exam.title,
          description: exam.description ?? "",
          instructorName: exam.instructorName,
          taNames: exam.taNames,
          slug: exam.slug,
          availabilityStart: exam.availabilityStart?.toISOString() ?? undefined,
          availabilityEnd: exam.availabilityEnd?.toISOString() ?? undefined,
          durationMinutes: exam.durationMinutes,
          timerMode: exam.timerMode,
          perQuestionSeconds: exam.perQuestionSeconds ?? null,
          attemptsAllowed: exam.attemptsAllowed,
          randomizeQuestions: exam.randomizeQuestions,
          randomizeOptions: exam.randomizeOptions,
          allowBacktracking: exam.allowBacktracking,
          allowExternalStudents: exam.allowExternalStudents,
          continueAfterAvailability: exam.continueAfterAvailability,
          fullScreenRequired: exam.fullScreenRequired,
          defaultMarks: Number(exam.defaultMarks),
          defaultNegativeMarks: Number(exam.defaultNegativeMarks),
          msqGradingPolicy: exam.msqGradingPolicy,
          numericalTolerance: exam.numericalTolerance ? Number(exam.numericalTolerance) : null,
          textGradingMode: exam.textGradingMode,
          resultRelease: exam.resultRelease,
        }}
        isEdit
        submitLabel="Save Settings"
      />

      {/* Roster */}
      <div className="rounded-xl border border-border bg-card px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Student Roster</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {exam._count.roster} student{exam._count.roster !== 1 ? "s" : ""} enrolled
            {exam._count.roster === 0 && " — add students via the roster page"}
          </p>
        </div>
        <Link
          href={`/admin/exams/${exam.id}/roster`}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
        >
          Manage Roster →
        </Link>
      </div>
    </div>
  );
}
