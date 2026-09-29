"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { CreateCourseSchema, UpdateCourseSchema } from "@/lib/validation/course";
import { requireCourseAccess, canManageCourseTeachers } from "@/lib/courseAccess";
import { getSessionUser } from "@/lib/auth";

export type CourseActionState = { error: string; success: boolean };

export async function createCourseAction(
  _prev: CourseActionState,
  formData: FormData
): Promise<CourseActionState> {
  const user = await requireAdmin();
  if (!user) return { error: "Unauthorized", success: false };

  const raw = {
    name: formData.get("name") as string,
    code: formData.get("code") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = CreateCourseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const existing = await db.course.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    return { error: "A course with this code already exists", success: false };
  }

  const course = await db.course.create({
    data: {
      name: parsed.data.name.trim(),
      code: parsed.data.code,
      description: parsed.data.description?.trim() || null,
      createdById: user.id,
    },
  });

  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${course.id}`);
}

export async function updateCourseAction(
  courseId: string,
  _prev: CourseActionState,
  formData: FormData
): Promise<CourseActionState> {
  if (!(await requireCourseAccess(courseId))) return { error: "Unauthorized", success: false };

  const raw = {
    name: formData.get("name") as string,
    code: formData.get("code") as string,
    description: formData.get("description") as string | undefined,
  };

  const parsed = UpdateCourseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Course not found", success: false };

  if (parsed.data.code && parsed.data.code !== course.code) {
    const existing = await db.course.findUnique({ where: { code: parsed.data.code } });
    if (existing) {
      return { error: "A course with this code already exists", success: false };
    }
  }

  await db.course.update({
    where: { id: courseId },
    data: {
      ...(parsed.data.name && { name: parsed.data.name.trim() }),
      ...(parsed.data.code && { code: parsed.data.code }),
      description: parsed.data.description?.trim() || null,
    },
  });

  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  return { error: "", success: true };
}

export async function deleteCourseAction(courseId: string): Promise<{ error?: string; success?: boolean }> {
  if (!(await requireCourseAccess(courseId))) return { error: "Unauthorized" };

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.isDeleted) return { error: "Course not found" };

  await db.course.update({ where: { id: courseId }, data: { isDeleted: true } });
  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function toggleCourseActiveAction(courseId: string, isActive: boolean) {
  if (!(await requireCourseAccess(courseId))) return { error: "Unauthorized" };

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Course not found" };

  await db.course.update({ where: { id: courseId }, data: { isActive } });
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  return { success: true };
}

// ── Course teachers ───────────────────────────────────────────────────────────
// Only the course creator or a SUPER_ADMIN may change this list — see
// canManageCourseTeachers in lib/courseAccess.ts for why it's stricter than
// the general "can this admin manage the course" check.

export type AddTeacherState = { error: string; success: boolean };

export async function addCourseTeacherAction(
  courseId: string,
  _prev: AddTeacherState,
  formData: FormData
): Promise<AddTeacherState> {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized", success: false };
  if (!(await canManageCourseTeachers(user, courseId))) {
    return { error: "Only the course creator can manage teachers", success: false };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return { error: "Email is required", success: false };

  const target = await db.user.findUnique({ where: { email } });
  if (!target || !target.isActive) {
    return { error: "No active admin account with that email", success: false };
  }

  const course = await db.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
  if (!course) return { error: "Course not found", success: false };
  if (target.id === course.createdById) {
    return { error: `${target.name} already owns this course`, success: false };
  }

  const existing = await db.courseTeacher.findUnique({
    where: { courseId_userId: { courseId, userId: target.id } },
  });
  if (existing) return { error: `${target.name} is already a teacher on this course`, success: false };

  await db.courseTeacher.create({ data: { courseId, userId: target.id } });
  revalidatePath(`/admin/courses/${courseId}`);
  return { error: "", success: true };
}

export async function removeCourseTeacherAction(
  courseId: string,
  teacherId: string
): Promise<{ error?: string; success?: boolean }> {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };
  if (!(await canManageCourseTeachers(user, courseId))) {
    return { error: "Only the course creator can manage teachers" };
  }

  await db.courseTeacher.deleteMany({ where: { id: teacherId, courseId } });
  revalidatePath(`/admin/courses/${courseId}`);
  return { success: true };
}
