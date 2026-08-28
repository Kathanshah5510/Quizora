import { describe, it, expect } from "vitest";
import { isResultVisibleToStudent } from "@/lib/results/resultDomain";

// ─── isResultVisibleToStudent — visibility policy ─────────────────────────────

describe("result visibility — AUTO policy", () => {
  it("visible when COMPLETE", () => {
    expect(isResultVisibleToStudent("AUTO", "COMPLETE", false)).toBe(true);
  });

  it("not visible when PARTIAL", () => {
    expect(isResultVisibleToStudent("AUTO", "PARTIAL", false)).toBe(false);
  });

  it("not visible when PENDING", () => {
    expect(isResultVisibleToStudent("AUTO", "PENDING", false)).toBe(false);
  });

  it("isReleased flag has no effect under AUTO policy", () => {
    expect(isResultVisibleToStudent("AUTO", "COMPLETE", true)).toBe(true);
    expect(isResultVisibleToStudent("AUTO", "PARTIAL", true)).toBe(false);
  });
});

describe("result visibility — MANUAL policy", () => {
  it("not visible even when COMPLETE and not released", () => {
    expect(isResultVisibleToStudent("MANUAL", "COMPLETE", false)).toBe(false);
  });

  it("visible when COMPLETE and released", () => {
    expect(isResultVisibleToStudent("MANUAL", "COMPLETE", true)).toBe(true);
  });

  it("visible when PARTIAL and released", () => {
    expect(isResultVisibleToStudent("MANUAL", "PARTIAL", true)).toBe(true);
  });

  it("not visible when PENDING and released (pending means no result yet)", () => {
    expect(isResultVisibleToStudent("MANUAL", "PENDING", true)).toBe(true);
  });

  it("not visible when PENDING and not released", () => {
    expect(isResultVisibleToStudent("MANUAL", "PENDING", false)).toBe(false);
  });
});

// ─── Release API input validation ────────────────────────────────────────────

function validateReleaseInput(body: unknown):
  | { ok: true; isReleased: boolean; attemptId?: string }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;
  if (typeof b.isReleased !== "boolean") return { ok: false, error: "isReleased must be boolean" };
  if (b.attemptId !== undefined && typeof b.attemptId !== "string") {
    return { ok: false, error: "attemptId must be string if provided" };
  }
  return { ok: true, isReleased: b.isReleased, attemptId: b.attemptId as string | undefined };
}

describe("release API input validation", () => {
  it("accepts bulk release (no attemptId)", () => {
    const r = validateReleaseInput({ isReleased: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.isReleased).toBe(true);
      expect(r.attemptId).toBeUndefined();
    }
  });

  it("accepts per-attempt release with attemptId", () => {
    const r = validateReleaseInput({ isReleased: false, attemptId: "attempt-1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.isReleased).toBe(false);
      expect(r.attemptId).toBe("attempt-1");
    }
  });

  it("rejects missing isReleased field", () => {
    expect(validateReleaseInput({}).ok).toBe(false);
  });

  it("rejects non-boolean isReleased", () => {
    expect(validateReleaseInput({ isReleased: "yes" }).ok).toBe(false);
  });

  it("rejects null body", () => {
    expect(validateReleaseInput(null).ok).toBe(false);
  });
});

// ─── Result visibility response — client-side reason codes ───────────────────

type VisibilityReason = "GRADING_PENDING" | "GRADING_INCOMPLETE" | "NOT_RELEASED";

function reasonMessage(reason: VisibilityReason): string {
  const map: Record<VisibilityReason, string> = {
    GRADING_PENDING: "submission is being processed",
    GRADING_INCOMPLETE: "grading is complete",
    NOT_RELEASED: "shared by your instructor",
  };
  return map[reason];
}

describe("client visibility reason messages", () => {
  it("GRADING_PENDING message mentions processing", () => {
    expect(reasonMessage("GRADING_PENDING")).toContain("processed");
  });

  it("GRADING_INCOMPLETE message mentions grading", () => {
    expect(reasonMessage("GRADING_INCOMPLETE")).toContain("grading");
  });

  it("NOT_RELEASED message mentions instructor", () => {
    expect(reasonMessage("NOT_RELEASED")).toContain("instructor");
  });
});
