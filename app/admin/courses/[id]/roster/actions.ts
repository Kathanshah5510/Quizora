"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCourseAccess } from "@/lib/courseAccess";
import { StudentIdentitySchema } from "@/lib/validation/student";
import { parseRosterCSV } from "@/lib/utils";

export type RosterActionState = { error: string; success: boolean };
export type RosterCSVState = {
  error: string;
  success: boolean;
  stats?: { added: number; errors: number; total: number };
};

export async function addCourseStudentAction(
  courseId: string,
  _prev: RosterActionState,
  formData: FormData
): Promise<RosterActionState> {
  if (!(await requireCourseAccess(courseId))) return { error: "Unauthorized", success: false };

  const raw = {
    studentId: (formData.get("studentId") as string)?.trim(),
    name: (formData.get("name") as string)?.trim(),
    email: (formData.get("email") as string)?.trim(),
  };

  const parsed = StudentIdentitySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message, success: false };
  }

  await db.courseRoster.upsert({
    where: { courseId_studentId: { courseId, studentId: parsed.data.studentId } },
    create: {
      courseId,
      studentId: parsed.data.studentId,
      name: parsed.data.name,
      email: parsed.data.email,
    },
    update: { name: parsed.data.name, email: parsed.data.email },
  });

  revalidatePath(`/admin/courses/${courseId}/roster`);
  return { error: "", success: true };
}

export async function removeCourseStudentAction(
  courseId: string,
  studentId: string
): Promise<{ error?: string; success?: boolean }> {
  if (!(await requireCourseAccess(courseId))) return { error: "Unauthorized" };

  await db.courseRoster.deleteMany({ where: { courseId, studentId } });
  revalidatePath(`/admin/courses/${courseId}/roster`);
  return { success: true };
}

export async function uploadCourseRosterCSVAction(
  courseId: string,
  _prev: RosterCSVState,
  formData: FormData
): Promise<RosterCSVState> {
  if (!(await requireCourseAccess(courseId))) return { error: "Unauthorized", success: false };

  const file = formData.get("csv") as File | null;
  if (!file || file.size === 0) return { error: "No file selected", success: false };

  const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
  if (file.size > MAX_BYTES) return { error: "File too large (max 2 MB)", success: false };

  const text = await file.text();
  const rows = parseRosterCSV(text);

  if (rows.length === 0) return { error: "CSV appears to be empty or has no valid rows", success: false };

  let added = 0;
  let errors = 0;

  for (const row of rows) {
    const parsed = StudentIdentitySchema.safeParse(row);
    if (!parsed.success) {
      errors++;
      continue;
    }
    try {
      await db.courseRoster.upsert({
        where: { courseId_studentId: { courseId, studentId: parsed.data.studentId } },
        create: {
          courseId,
          studentId: parsed.data.studentId,
          name: parsed.data.name,
          email: parsed.data.email,
        },
        update: { name: parsed.data.name, email: parsed.data.email },
      });
      added++;
    } catch {
      errors++;
    }
  }

  revalidatePath(`/admin/courses/${courseId}/roster`);
  return { error: "", success: true, stats: { added, errors, total: rows.length } };
}
