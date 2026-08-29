"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { CreateExamSchema, UpdateExamSchema, parseExamFormData } from "@/lib/validation/exam";
import { generateExamSlug } from "@/lib/utils";

export type ExamActionState = { error: string; success: boolean };

export async function createExamAction(
  _prev: ExamActionState,
  formData: FormData
): Promise<ExamActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized", success: false };

  const raw = parseExamFormData(formData);
  const parsed = CreateExamSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const course = await db.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) return { error: "Course not found", success: false };

  const slug = generateExamSlug(parsed.data.title);

  const exam = await db.exam.create({
    data: {
      courseId: parsed.data.courseId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      instructorName: parsed.data.instructorName,
      taNames: parsed.data.taNames ?? [],
      slug,
      durationMinutes: parsed.data.durationMinutes,
      timerMode: parsed.data.timerMode,
      perQuestionSeconds: parsed.data.perQuestionSeconds ?? null,
      attemptsAllowed: parsed.data.attemptsAllowed,
      randomizeQuestions: parsed.data.randomizeQuestions,
      randomizeOptions: parsed.data.randomizeOptions,
      allowBacktracking: parsed.data.allowBacktracking,
      allowExternalStudents: parsed.data.allowExternalStudents,
      continueAfterAvailability: parsed.data.continueAfterAvailability,
      fullScreenRequired: parsed.data.fullScreenRequired,
      reconnectGraceSeconds: parsed.data.reconnectGraceSeconds,
      maxTabViolations: parsed.data.maxTabViolations,
      defaultMarks: parsed.data.defaultMarks,
      defaultNegativeMarks: parsed.data.defaultNegativeMarks,
      msqGradingPolicy: parsed.data.msqGradingPolicy,
      numericalTolerance: parsed.data.numericalTolerance ?? null,
      textGradingMode: parsed.data.textGradingMode,
      resultRelease: parsed.data.resultRelease,
      availabilityStart: parsed.data.availabilityStart ? new Date(parsed.data.availabilityStart) : null,
      availabilityEnd: parsed.data.availabilityEnd ? new Date(parsed.data.availabilityEnd) : null,
      createdById: user.id,
    },
  });

  revalidatePath("/admin/exams");
  redirect(`/admin/exams/${exam.id}`);
}

// ── Lifecycle actions ─────────────────────────────────────────────────────────

type LifecycleResult = { error?: string; success?: boolean };

export async function deleteExamAction(examId: string): Promise<LifecycleResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.isDeleted) return { error: "Exam not found" };

  await db.exam.update({ where: { id: examId }, data: { isDeleted: true } });
  revalidatePath("/admin/exams");
  redirect("/admin/exams");
}

export async function publishExamAction(examId: string): Promise<LifecycleResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) return { error: "Exam not found" };

  const { validatePublish } = await import("@/lib/services/exam-lifecycle");
  const err = validatePublish(exam);
  if (err) return { error: err };

  await db.exam.update({ where: { id: examId }, data: { status: "PUBLISHED" } });
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/exams");
  return { success: true };
}

export async function unpublishExamAction(examId: string): Promise<LifecycleResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: { _count: { select: { attempts: true } } },
  });
  if (!exam) return { error: "Exam not found" };

  const { validateUnpublish } = await import("@/lib/services/exam-lifecycle");
  const err = validateUnpublish({ ...exam, attemptCount: exam._count.attempts });
  if (err) return { error: err };

  await db.exam.update({ where: { id: examId }, data: { status: "DRAFT" } });
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/exams");
  return { success: true };
}

export async function closeExamAction(examId: string): Promise<LifecycleResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) return { error: "Exam not found" };

  const { validateClose } = await import("@/lib/services/exam-lifecycle");
  const err = validateClose(exam);
  if (err) return { error: err };

  await db.exam.update({ where: { id: examId }, data: { status: "CLOSED" } });
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/exams");
  return { success: true };
}

export async function reopenExamAction(examId: string): Promise<LifecycleResult> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized" };

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) return { error: "Exam not found" };

  const { validateReopen } = await import("@/lib/services/exam-lifecycle");
  const err = validateReopen(exam);
  if (err) return { error: err };

  await db.exam.update({ where: { id: examId }, data: { status: "PUBLISHED" } });
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/exams");
  return { success: true };
}

// ── Settings update ───────────────────────────────────────────────────────────

export async function updateExamAction(
  examId: string,
  _prev: ExamActionState,
  formData: FormData
): Promise<ExamActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized", success: false };

  const rawForm = parseExamFormData(formData);
  const slug = (formData.get("slug") as string)?.trim();
  const raw = { ...rawForm, slug: slug || undefined };

  const parsed = UpdateExamSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) return { error: "Exam not found", success: false };

  if (["ACTIVE", "CLOSED"].includes(exam.status)) {
    return { error: "Cannot edit a closed or active exam's settings", success: false };
  }

  if (parsed.data.slug && parsed.data.slug !== exam.slug) {
    const existing = await db.exam.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return { error: "That URL slug is already taken", success: false };
  }

  const data = parsed.data;
  await db.exam.update({
    where: { id: examId },
    data: {
      ...(data.courseId !== undefined && { courseId: data.courseId }),
      ...(data.title !== undefined && { title: data.title }),
      description: data.description ?? null,
      ...(data.instructorName !== undefined && { instructorName: data.instructorName }),
      ...(data.taNames !== undefined && { taNames: data.taNames }),
      ...(data.slug !== undefined && { slug: data.slug }),
      availabilityStart: data.availabilityStart ? new Date(data.availabilityStart) : null,
      availabilityEnd: data.availabilityEnd ? new Date(data.availabilityEnd) : null,
      ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
      ...(data.timerMode !== undefined && { timerMode: data.timerMode }),
      perQuestionSeconds: data.perQuestionSeconds ?? null,
      ...(data.attemptsAllowed !== undefined && { attemptsAllowed: data.attemptsAllowed }),
      ...(data.randomizeQuestions !== undefined && { randomizeQuestions: data.randomizeQuestions }),
      ...(data.randomizeOptions !== undefined && { randomizeOptions: data.randomizeOptions }),
      ...(data.allowBacktracking !== undefined && { allowBacktracking: data.allowBacktracking }),
      ...(data.allowExternalStudents !== undefined && { allowExternalStudents: data.allowExternalStudents }),
      ...(data.continueAfterAvailability !== undefined && { continueAfterAvailability: data.continueAfterAvailability }),
      ...(data.fullScreenRequired !== undefined && { fullScreenRequired: data.fullScreenRequired }),
      ...(data.reconnectGraceSeconds !== undefined && { reconnectGraceSeconds: data.reconnectGraceSeconds }),
      ...(data.maxTabViolations !== undefined && { maxTabViolations: data.maxTabViolations }),
      ...(data.defaultMarks !== undefined && { defaultMarks: data.defaultMarks }),
      ...(data.defaultNegativeMarks !== undefined && { defaultNegativeMarks: data.defaultNegativeMarks }),
      ...(data.msqGradingPolicy !== undefined && { msqGradingPolicy: data.msqGradingPolicy }),
      numericalTolerance: data.numericalTolerance ?? null,
      ...(data.textGradingMode !== undefined && { textGradingMode: data.textGradingMode }),
      ...(data.resultRelease !== undefined && { resultRelease: data.resultRelease }),
    },
  });

  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/exams");
  return { error: "", success: true };
}
