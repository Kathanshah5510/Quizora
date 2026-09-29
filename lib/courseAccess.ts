/**
 * Per-course access control.
 *
 * A course is manageable by: a SUPER_ADMIN (always), the course's creator, or
 * an admin explicitly added via CourseTeacher. Every admin route that reads or
 * writes a course's exams, questions, roster, results, or grading must check
 * this — there is no other isolation between courses.
 *
 * Access-denied resolves to `null` (pages call notFound()/redirect on that,
 * API routes return 404) rather than a distinct "forbidden" response, so a
 * blocked admin can't tell a course exists from the response alone.
 */
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/** True if `user` may manage the given course. */
export async function canAccessCourse(user: SessionUser, courseId: string): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      createdById: true,
      teachers: { where: { userId: user.id }, select: { id: true } },
    },
  });
  if (!course) return false;
  if (course.createdById === user.id) return true;
  return course.teachers.length > 0;
}

/**
 * Requires a logged-in admin AND access to this course.
 * Returns the session user on success, null otherwise (course missing,
 * caller not logged in, or logged in but not permitted).
 */
export async function requireCourseAccess(courseId: string): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const allowed = await canAccessCourse(user, courseId);
  return allowed ? user : null;
}

/**
 * Requires a logged-in admin AND access to the course that owns this exam.
 * Returns the session user plus the exam's courseId, or null.
 */
export async function requireExamAccess(
  examId: string
): Promise<{ user: SessionUser; courseId: string } | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true } });
  if (!exam) return null;

  const allowed = await canAccessCourse(user, exam.courseId);
  return allowed ? { user, courseId: exam.courseId } : null;
}

/**
 * True only for the course creator or a SUPER_ADMIN — stricter than general
 * course access. Used to gate the teacher list itself, so an added teacher
 * cannot add or remove other teachers (or remove the owner).
 */
export async function canManageCourseTeachers(user: SessionUser, courseId: string): Promise<boolean> {
  if (user.role === "SUPER_ADMIN") return true;
  const course = await db.course.findUnique({ where: { id: courseId }, select: { createdById: true } });
  return course?.createdById === user.id;
}
