import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import MonitorClient from "./MonitorClient";

export const metadata: Metadata = { title: "Live Monitor" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MonitorPage({ params }: Props) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  const { id: examId } = await params;

  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      status: true,
      durationMinutes: true,
      availabilityStart: true,
      availabilityEnd: true,
      course: { select: { code: true } },
      _count: { select: { roster: true } },
    },
  });
  if (!exam) notFound();

  const attempts = await db.examAttempt.findMany({
    where: { examId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      studentId: true,
      studentName: true,
      studentEmail: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      lastActiveAt: true,
      tabViolations: true,
      submissionId: true,
    },
  });

  const recentEvents = await db.examEvent.findMany({
    where: { attempt: { examId } },
    orderBy: { recordedAt: "desc" },
    take: 30,
    select: {
      id: true,
      eventType: true,
      metadata: true,
      recordedAt: true,
      attempt: {
        select: { id: true, studentName: true, studentId: true },
      },
    },
  });

  const stats = {
    enrolled: exam._count.roster,
    totalAttempts: attempts.length,
    inProgress: attempts.filter((a) => a.status === "IN_PROGRESS").length,
    submitted: attempts.filter((a) => a.status === "SUBMITTED").length,
    expired: attempts.filter((a) => a.status === "EXPIRED").length,
    abandoned: attempts.filter((a) => a.status === "ABANDONED").length,
    flagged: attempts.filter((a) => a.tabViolations > 0).length,
    notStarted: Math.max(0, exam._count.roster - attempts.length),
  };

  const initialData = {
    exam: {
      id: exam.id,
      title: exam.title,
      status: exam.status,
      courseCode: exam.course.code,
      durationMinutes: exam.durationMinutes,
      availabilityStart: exam.availabilityStart?.toISOString() ?? null,
      availabilityEnd: exam.availabilityEnd?.toISOString() ?? null,
    },
    stats,
    attempts: attempts.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: a.studentName,
      studentEmail: a.studentEmail,
      status: a.status,
      startedAt: a.startedAt.toISOString(),
      submittedAt: a.submittedAt?.toISOString() ?? null,
      lastActiveAt: a.lastActiveAt.toISOString(),
      tabViolations: a.tabViolations,
      submissionId: a.submissionId,
    })),
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      metadata: e.metadata,
      recordedAt: e.recordedAt.toISOString(),
      studentName: e.attempt.studentName,
      studentId: e.attempt.studentId,
      attemptId: e.attempt.id,
    })),
    generatedAt: new Date().toISOString(),
  };

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/admin/exams/${examId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          ← Back to Exam
        </Link>
      </div>
      <MonitorClient examId={examId} initialData={initialData} />
    </div>
  );
}
