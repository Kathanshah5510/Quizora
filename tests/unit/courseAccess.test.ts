import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocked before import so lib/courseAccess.ts picks up the mocks, not the real
// DB/session modules. Tests exercise the actual exported functions — not a
// re-implementation — since this module is the single gate for every
// course-scoped route in the app.
const findUniqueCourse = vi.fn();
const findUniqueExam = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    course: { findUnique: (...args: unknown[]) => findUniqueCourse(...args) },
    exam: { findUnique: (...args: unknown[]) => findUniqueExam(...args) },
  },
}));

const getSessionUser = vi.fn();
vi.mock("@/lib/auth", () => ({ getSessionUser: (...args: unknown[]) => getSessionUser(...args) }));

const { canAccessCourse, requireCourseAccess, requireExamAccess, canManageCourseTeachers } = await import(
  "@/lib/courseAccess"
);

const superAdmin = { id: "super-1", email: "s@x.com", name: "Super", role: "SUPER_ADMIN" as const };
const owner = { id: "owner-1", email: "o@x.com", name: "Owner", role: "ADMIN" as const };
const teacher = { id: "teacher-1", email: "t@x.com", name: "Teacher", role: "ADMIN" as const };
const stranger = { id: "stranger-1", email: "st@x.com", name: "Stranger", role: "ADMIN" as const };

beforeEach(() => {
  findUniqueCourse.mockReset();
  findUniqueExam.mockReset();
  getSessionUser.mockReset();
});

describe("canAccessCourse", () => {
  it("grants a super admin access without querying the course's teacher list", async () => {
    const allowed = await canAccessCourse(superAdmin, "course-1");
    expect(allowed).toBe(true);
    expect(findUniqueCourse).not.toHaveBeenCalled();
  });

  it("grants the course creator access", async () => {
    findUniqueCourse.mockResolvedValue({ createdById: owner.id, teachers: [] });
    expect(await canAccessCourse(owner, "course-1")).toBe(true);
  });

  it("grants an admin listed as a teacher on the course", async () => {
    findUniqueCourse.mockResolvedValue({ createdById: owner.id, teachers: [{ id: "ct-1" }] });
    expect(await canAccessCourse(teacher, "course-1")).toBe(true);
  });

  it("denies an admin who is neither creator nor teacher", async () => {
    findUniqueCourse.mockResolvedValue({ createdById: owner.id, teachers: [] });
    expect(await canAccessCourse(stranger, "course-1")).toBe(false);
  });

  it("denies access when the course does not exist", async () => {
    findUniqueCourse.mockResolvedValue(null);
    expect(await canAccessCourse(stranger, "missing-course")).toBe(false);
  });

  it("scopes the teacher lookup to the querying user only", async () => {
    findUniqueCourse.mockResolvedValue({ createdById: owner.id, teachers: [] });
    await canAccessCourse(teacher, "course-1");
    expect(findUniqueCourse).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "course-1" },
        select: expect.objectContaining({
          teachers: expect.objectContaining({ where: { userId: teacher.id } }),
        }),
      })
    );
  });
});

describe("requireCourseAccess", () => {
  it("returns null when nobody is logged in", async () => {
    getSessionUser.mockResolvedValue(null);
    expect(await requireCourseAccess("course-1")).toBeNull();
    expect(findUniqueCourse).not.toHaveBeenCalled();
  });

  it("returns the user when access is granted", async () => {
    getSessionUser.mockResolvedValue(owner);
    findUniqueCourse.mockResolvedValue({ createdById: owner.id, teachers: [] });
    expect(await requireCourseAccess("course-1")).toEqual(owner);
  });

  it("returns null when logged in but not permitted", async () => {
    getSessionUser.mockResolvedValue(stranger);
    findUniqueCourse.mockResolvedValue({ createdById: owner.id, teachers: [] });
    expect(await requireCourseAccess("course-1")).toBeNull();
  });
});

describe("requireExamAccess", () => {
  it("returns null when the exam does not exist, without ever checking course access", async () => {
    getSessionUser.mockResolvedValue(owner);
    findUniqueExam.mockResolvedValue(null);
    expect(await requireExamAccess("missing-exam")).toBeNull();
    expect(findUniqueCourse).not.toHaveBeenCalled();
  });

  it("resolves the exam's course and grants access to its teacher", async () => {
    getSessionUser.mockResolvedValue(teacher);
    findUniqueExam.mockResolvedValue({ courseId: "course-1" });
    findUniqueCourse.mockResolvedValue({ createdById: owner.id, teachers: [{ id: "ct-1" }] });
    const result = await requireExamAccess("exam-1");
    expect(result).toEqual({ user: teacher, courseId: "course-1" });
  });

  it("denies a stranger even though the exam itself exists", async () => {
    getSessionUser.mockResolvedValue(stranger);
    findUniqueExam.mockResolvedValue({ courseId: "course-1" });
    findUniqueCourse.mockResolvedValue({ createdById: owner.id, teachers: [] });
    expect(await requireExamAccess("exam-1")).toBeNull();
  });
});

describe("canManageCourseTeachers — stricter than general access", () => {
  it("allows the creator", async () => {
    findUniqueCourse.mockResolvedValue({ createdById: owner.id });
    expect(await canManageCourseTeachers(owner, "course-1")).toBe(true);
  });

  it("allows a super admin without querying the course", async () => {
    expect(await canManageCourseTeachers(superAdmin, "course-1")).toBe(true);
    expect(findUniqueCourse).not.toHaveBeenCalled();
  });

  it("denies an added teacher — a teacher cannot add/remove other teachers or the owner", async () => {
    findUniqueCourse.mockResolvedValue({ createdById: owner.id });
    expect(await canManageCourseTeachers(teacher, "course-1")).toBe(false);
  });
});
