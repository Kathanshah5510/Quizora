import { describe, it, expect } from "vitest";
import { AIGradingNotConfiguredError } from "@/lib/ai/gradeText";

// ─── Approve/reject action validation ─────────────────────────────────────────

type ApproveAction =
  | { action: "approve" }
  | { action: "override"; score: number }
  | { action: "reject" };

function validateApproveBody(body: unknown):
  | { ok: true; value: ApproveAction }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;
  if (b.action === "approve") return { ok: true, value: { action: "approve" } };
  if (b.action === "reject") return { ok: true, value: { action: "reject" } };
  if (b.action === "override") {
    if (typeof b.score !== "number" || b.score < 0)
      return { ok: false, error: "override requires a non-negative score" };
    return { ok: true, value: { action: "override", score: b.score } };
  }
  return { ok: false, error: "action must be approve, reject, or override" };
}

describe("AI grade approval action validation", () => {
  it("accepts 'approve' action", () => {
    const r = validateApproveBody({ action: "approve" });
    expect(r.ok).toBe(true);
  });

  it("accepts 'reject' action", () => {
    const r = validateApproveBody({ action: "reject" });
    expect(r.ok).toBe(true);
  });

  it("accepts 'override' with valid score", () => {
    const r = validateApproveBody({ action: "override", score: 2.5 });
    expect(r.ok).toBe(true);
    if (r.ok && r.value.action === "override") expect(r.value.score).toBe(2.5);
  });

  it("rejects 'override' without score", () => {
    expect(validateApproveBody({ action: "override" }).ok).toBe(false);
  });

  it("rejects 'override' with negative score", () => {
    expect(validateApproveBody({ action: "override", score: -1 }).ok).toBe(false);
  });

  it("rejects unknown action", () => {
    expect(validateApproveBody({ action: "delete" }).ok).toBe(false);
  });

  it("rejects null body", () => {
    expect(validateApproveBody(null).ok).toBe(false);
  });
});

// ─── Score computation for approve vs override ─────────────────────────────────

function computeApprovedScore(
  action: "approve" | "override",
  aiScore: number,
  overrideScore: number | undefined,
  maxMarks: number
): number {
  const raw = action === "override" ? (overrideScore ?? 0) : aiScore;
  return Math.min(maxMarks, Math.max(0, raw));
}

describe("approved score computation", () => {
  it("approve uses AI score directly", () => {
    expect(computeApprovedScore("approve", 3, undefined, 5)).toBe(3);
  });

  it("override uses the admin-specified score", () => {
    expect(computeApprovedScore("override", 3, 4, 5)).toBe(4);
  });

  it("override clamps to maxMarks", () => {
    expect(computeApprovedScore("override", 3, 99, 5)).toBe(5);
  });

  it("override clamps to 0 for negative", () => {
    expect(computeApprovedScore("override", 3, -2, 5)).toBe(0);
  });

  it("approve clamps AI score to maxMarks", () => {
    expect(computeApprovedScore("approve", 10, undefined, 5)).toBe(5);
  });
});

// ─── AIGradingNotConfiguredError ──────────────────────────────────────────────

describe("AIGradingNotConfiguredError", () => {
  it("is an instance of Error", () => {
    expect(new AIGradingNotConfiguredError()).toBeInstanceOf(Error);
  });

  it("has correct name", () => {
    const err = new AIGradingNotConfiguredError();
    expect(err.name).toBe("AIGradingNotConfiguredError");
  });

  it("message mentions API key env var", () => {
    const err = new AIGradingNotConfiguredError();
    expect(err.message).toContain("GEMINI_API_KEY");
  });
});

// ─── AI grading status transitions ───────────────────────────────────────────

type AIGradingStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

function nextStatus(action: "approve" | "override" | "reject"): AIGradingStatus {
  if (action === "reject") return "REJECTED";
  return "APPROVED";
}

describe("AI grading status transitions", () => {
  it("approve → APPROVED", () => expect(nextStatus("approve")).toBe("APPROVED"));
  it("override → APPROVED", () => expect(nextStatus("override")).toBe("APPROVED"));
  it("reject → REJECTED", () => expect(nextStatus("reject")).toBe("REJECTED"));
});
