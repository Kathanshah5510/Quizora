import { describe, it, expect } from "vitest";

// ─── Delete-admin guard logic (contract tests) ────────────────────────────────
// These tests encode the business rules enforced in deleteAdminAction without
// spinning up the database or HTTP stack.

interface MockUser {
  id: string;
  role: "ADMIN" | "SUPER_ADMIN";
  courseCount: number;
  examCount: number;
}

function evaluateDeleteGuards(
  caller: { id: string; role: "ADMIN" | "SUPER_ADMIN" },
  target: MockUser,
  superAdminCount: number,
): { allowed: boolean; error?: string } {
  if (!caller || caller.role !== "SUPER_ADMIN") return { allowed: false, error: "Unauthorized" };
  if (target.id === caller.id) return { allowed: false, error: "You cannot delete your own account" };
  if (target.role === "SUPER_ADMIN" && superAdminCount <= 1) {
    return { allowed: false, error: "Cannot delete the last super admin" };
  }
  if (target.courseCount > 0 || target.examCount > 0) {
    return {
      allowed: false,
      error: `This admin owns ${target.courseCount} course(s) and ${target.examCount} exam(s). Deactivate them instead.`,
    };
  }
  return { allowed: true };
}

const superAdmin: { id: string; role: "SUPER_ADMIN" } = { id: "super-1", role: "SUPER_ADMIN" };
const regularAdmin: { id: string; role: "ADMIN" } = { id: "admin-1", role: "ADMIN" };

describe("deleteAdminAction — guard logic", () => {
  it("rejects non-super-admin callers", () => {
    const target: MockUser = { id: "admin-2", role: "ADMIN", courseCount: 0, examCount: 0 };
    const result = evaluateDeleteGuards(regularAdmin, target, 1);
    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Unauthorized");
  });

  it("rejects self-deletion", () => {
    const target: MockUser = { id: superAdmin.id, role: "SUPER_ADMIN", courseCount: 0, examCount: 0 };
    const result = evaluateDeleteGuards(superAdmin, target, 2);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/your own account/i);
  });

  it("rejects deletion of the last super admin", () => {
    const target: MockUser = { id: "super-2", role: "SUPER_ADMIN", courseCount: 0, examCount: 0 };
    const result = evaluateDeleteGuards(superAdmin, target, 1);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/last super admin/i);
  });

  it("allows deletion of a super admin when others remain", () => {
    const target: MockUser = { id: "super-2", role: "SUPER_ADMIN", courseCount: 0, examCount: 0 };
    const result = evaluateDeleteGuards(superAdmin, target, 3);
    expect(result.allowed).toBe(true);
  });

  it("rejects deletion if target owns courses", () => {
    const target: MockUser = { id: "admin-2", role: "ADMIN", courseCount: 2, examCount: 0 };
    const result = evaluateDeleteGuards(superAdmin, target, 1);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/course\(s\)/i);
  });

  it("rejects deletion if target owns exams", () => {
    const target: MockUser = { id: "admin-2", role: "ADMIN", courseCount: 0, examCount: 5 };
    const result = evaluateDeleteGuards(superAdmin, target, 1);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/exam\(s\)/i);
  });

  it("rejects deletion if target owns both courses and exams", () => {
    const target: MockUser = { id: "admin-2", role: "ADMIN", courseCount: 1, examCount: 3 };
    const result = evaluateDeleteGuards(superAdmin, target, 1);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain("1 course(s)");
    expect(result.error).toContain("3 exam(s)");
  });

  it("allows deletion of an admin with no owned content", () => {
    const target: MockUser = { id: "admin-2", role: "ADMIN", courseCount: 0, examCount: 0 };
    const result = evaluateDeleteGuards(superAdmin, target, 1);
    expect(result.allowed).toBe(true);
  });

  it("error message suggests deactivation when content blocks deletion", () => {
    const target: MockUser = { id: "admin-2", role: "ADMIN", courseCount: 0, examCount: 2 };
    const result = evaluateDeleteGuards(superAdmin, target, 1);
    expect(result.error).toMatch(/[Dd]eactivate/);
  });
});
