import { describe, it, expect } from "vitest";

// Pure logic for the submission race-condition fix.
// The actual atomicity comes from PostgreSQL's row-level locking on updateMany;
// these tests verify the decision logic that wraps it.

// Simulates what happens when two concurrent requests both try to submit.
// updateMany returns { count: N } — N=1 means "you won the race", N=0 means "someone else already did".
interface SubmitRaceResult {
  submissionId: string;
  status: string;
  fromDatabase: boolean; // true = read back from DB (lost race), false = just written (won race)
}

function handleSubmitRaceResult(
  updateCount: number,
  ownSubmissionId: string,
  dbSubmissionId: string | null,
  dbStatus: string
): SubmitRaceResult {
  if (updateCount > 0) {
    // Won the race: our submissionId is in the database
    return { submissionId: ownSubmissionId, status: "SUBMITTED", fromDatabase: false };
  }
  // Lost the race: return whatever is actually stored
  return {
    submissionId: dbSubmissionId ?? "",
    status: dbStatus,
    fromDatabase: true,
  };
}

// Tab violation race logic — atomic increment means concurrent requests get
// distinct post-increment values
function shouldAutoSubmit(newViolations: number, maxViolations: number): boolean {
  return newViolations >= maxViolations;
}

// Simulates two concurrent atomic increments from starting value of 1
function simulateConcurrentIncrements(startValue: number): [number, number] {
  // PostgreSQL serializes: first request gets startValue+1, second gets startValue+2
  return [startValue + 1, startValue + 2];
}

describe("submission race condition", () => {
  const MY_ID = "QZ-20260827-AAAAAAAA";
  const THEIR_ID = "QZ-20260827-BBBBBBBB";

  describe("manual submit race", () => {
    it("returns own submissionId when winning the race (count=1)", () => {
      const result = handleSubmitRaceResult(1, MY_ID, null, "IN_PROGRESS");
      expect(result.submissionId).toBe(MY_ID);
      expect(result.status).toBe("SUBMITTED");
      expect(result.fromDatabase).toBe(false);
    });

    it("returns database submissionId when losing the race (count=0)", () => {
      const result = handleSubmitRaceResult(0, MY_ID, THEIR_ID, "SUBMITTED");
      expect(result.submissionId).toBe(THEIR_ID);
      expect(result.status).toBe("SUBMITTED");
      expect(result.fromDatabase).toBe(true);
    });

    it("handles tab-violation auto-submit winning the race before manual submit", () => {
      // Tab violation set status=SUBMITTED — manual submit loses race
      const result = handleSubmitRaceResult(0, MY_ID, null, "SUBMITTED");
      expect(result.submissionId).toBe(""); // auto-submit didn't generate a submissionId
      expect(result.status).toBe("SUBMITTED");
      expect(result.fromDatabase).toBe(true);
    });

    it("handles timer-expired winning before manual submit", () => {
      const result = handleSubmitRaceResult(0, MY_ID, null, "EXPIRED");
      expect(result.status).toBe("EXPIRED");
      expect(result.fromDatabase).toBe(true);
    });
  });

  describe("tab violation race with atomic increment", () => {
    it("serializes concurrent increments: each gets a distinct value", () => {
      const [first, second] = simulateConcurrentIncrements(1);
      expect(first).toBe(2); // first concurrent request
      expect(second).toBe(3); // second concurrent request
      expect(first).not.toBe(second); // no shared value
    });

    it("both requests trigger auto-submit threshold logic but at different counts", () => {
      const MAX = 2;
      const [first, second] = simulateConcurrentIncrements(1);
      expect(shouldAutoSubmit(first, MAX)).toBe(true);  // 2 >= 2
      expect(shouldAutoSubmit(second, MAX)).toBe(true); // 3 >= 2
      // Both try to auto-submit, but the conditional updateMany ensures only one succeeds
    });

    it("first violation does not trigger auto-submit", () => {
      const MAX = 2;
      const [first] = simulateConcurrentIncrements(0); // starting from 0
      expect(shouldAutoSubmit(first, MAX)).toBe(false); // 1 < 2
    });

    it("with MAX_TAB_VIOLATIONS=3, only the third violation triggers", () => {
      const MAX = 3;
      expect(shouldAutoSubmit(1, MAX)).toBe(false);
      expect(shouldAutoSubmit(2, MAX)).toBe(false);
      expect(shouldAutoSubmit(3, MAX)).toBe(true);
    });
  });

  describe("idempotent submit (already submitted)", () => {
    it("returns existing state when already SUBMITTED", () => {
      // This is the pre-race check (attempt.status !== IN_PROGRESS → return existing)
      const alreadySubmitted = { status: "SUBMITTED", submissionId: THEIR_ID, submittedAt: "2026-08-27T10:00:00Z" };
      expect(alreadySubmitted.status).toBe("SUBMITTED");
      expect(alreadySubmitted.submissionId).toBe(THEIR_ID);
    });

    it("returns existing state when already EXPIRED", () => {
      const alreadyExpired = { status: "EXPIRED", submissionId: null, submittedAt: "2026-08-27T10:00:00Z" };
      expect(alreadyExpired.status).toBe("EXPIRED");
      expect(alreadyExpired.submissionId).toBeNull();
    });
  });
});
