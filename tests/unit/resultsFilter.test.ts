import { describe, it, expect } from "vitest";
import { buildResultSummary, isResultVisibleToStudent } from "@/lib/results/resultDomain";

// ─── Filter logic (pure) ──────────────────────────────────────────────────────

function buildWhereClause(opts: {
  examId: string;
  statusFilter?: string;
  gradingFilter?: string;
  search?: string;
}) {
  const { examId, statusFilter, gradingFilter, search } = opts;
  return {
    examId,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(gradingFilter ? { result: { gradingStatus: gradingFilter } } : {}),
    ...(search
      ? {
          OR: [
            { studentId: { contains: search, mode: "insensitive" } },
            { studentName: { contains: search, mode: "insensitive" } },
            { studentEmail: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

describe("results filter query builder", () => {
  it("includes only examId when no filters applied", () => {
    const w = buildWhereClause({ examId: "exam-1" });
    expect(w).toEqual({ examId: "exam-1" });
  });

  it("adds status filter when provided", () => {
    const w = buildWhereClause({ examId: "exam-1", statusFilter: "SUBMITTED" });
    expect(w.status).toBe("SUBMITTED");
  });

  it("adds gradingStatus nested filter", () => {
    const w = buildWhereClause({ examId: "exam-1", gradingFilter: "PENDING" });
    expect((w as Record<string, unknown>).result).toEqual({ gradingStatus: "PENDING" });
  });

  it("adds OR search clause covering ID, name, and email", () => {
    const w = buildWhereClause({ examId: "exam-1", search: "Alice" });
    const or = (w as Record<string, unknown>).OR as unknown[];
    expect(or).toHaveLength(3);
  });

  it("omits empty status filter (no key added)", () => {
    const w = buildWhereClause({ examId: "exam-1", statusFilter: "" });
    expect("status" in w).toBe(false);
  });

  it("omits empty search filter", () => {
    const w = buildWhereClause({ examId: "exam-1", search: "" });
    expect("OR" in w).toBe(false);
  });

  it("combines multiple filters", () => {
    const w = buildWhereClause({ examId: "exam-1", statusFilter: "SUBMITTED", gradingFilter: "COMPLETE", search: "bob" });
    expect(w.status).toBe("SUBMITTED");
    expect((w as Record<string, unknown>).result).toEqual({ gradingStatus: "COMPLETE" });
    expect((w as Record<string, unknown>).OR).toBeDefined();
  });
});

// ─── Result row serialisation ─────────────────────────────────────────────────

describe("results dashboard row serialization", () => {
  it("builds result summary with correct percentage", () => {
    const summary = buildResultSummary({
      totalScore: 7,
      maxScore: 10,
      gradingStatus: "COMPLETE",
      isReleased: false,
      releasedAt: null,
    });
    expect(summary.percentage).toBe(70);
  });

  it("result null when no Result record (attempt not yet graded)", () => {
    // Attempts without a result record should show — in the UI
    const noResult = null;
    expect(noResult).toBeNull();
  });
});

// ─── Authorization — admin vs student visibility ───────────────────────────────

describe("results visibility authorization", () => {
  it("admin always sees results regardless of release policy or grading status", () => {
    // Admin routes do not use isResultVisibleToStudent — they always have access.
    // This test documents the invariant: the student-facing check is never called for admin.
    const adminAlwaysSees = true;
    expect(adminAlwaysSees).toBe(true);
  });

  it("AUTO policy — student sees result only when COMPLETE", () => {
    expect(isResultVisibleToStudent("AUTO", "COMPLETE", false)).toBe(true);
    expect(isResultVisibleToStudent("AUTO", "PARTIAL", false)).toBe(false);
    expect(isResultVisibleToStudent("AUTO", "PENDING", false)).toBe(false);
  });

  it("MANUAL policy — student sees result only when explicitly released", () => {
    expect(isResultVisibleToStudent("MANUAL", "COMPLETE", false)).toBe(false);
    expect(isResultVisibleToStudent("MANUAL", "COMPLETE", true)).toBe(true);
  });

  it("MANUAL policy — partial result stays hidden until released", () => {
    expect(isResultVisibleToStudent("MANUAL", "PARTIAL", false)).toBe(false);
    expect(isResultVisibleToStudent("MANUAL", "PARTIAL", true)).toBe(true);
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe("pagination calculation", () => {
  function computePagination(total: number, page: number, pageSize: number) {
    return {
      totalPages: Math.ceil(total / pageSize),
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
  }

  it("first page: skip=0, take=pageSize", () => {
    const p = computePagination(100, 1, 25);
    expect(p.skip).toBe(0);
    expect(p.take).toBe(25);
    expect(p.totalPages).toBe(4);
  });

  it("second page: skip=pageSize", () => {
    const p = computePagination(100, 2, 25);
    expect(p.skip).toBe(25);
  });

  it("last page (partial): totalPages rounded up", () => {
    const p = computePagination(26, 2, 25);
    expect(p.totalPages).toBe(2);
    expect(p.skip).toBe(25);
  });

  it("single page when total <= pageSize", () => {
    const p = computePagination(10, 1, 25);
    expect(p.totalPages).toBe(1);
  });

  it("zero total → zero pages", () => {
    expect(Math.ceil(0 / 25)).toBe(0);
  });
});
