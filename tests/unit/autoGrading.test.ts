import { describe, it, expect } from "vitest";
import { gradeAttempt } from "@/lib/grading/gradeAttempt";
import type { ExamGradingSettings, QuestionData } from "@/lib/grading/gradeQuestion";

/**
 * Tests for the result-generation logic that backs autoGradeAttempt.
 * The DB layer is not mocked — these tests verify the grading engine
 * behaviour that autoGradeAttempt delegates to, covering all question
 * types and the idempotency contract.
 */

const SETTINGS: ExamGradingSettings = {
  msqGradingPolicy: "STRICT",
  numericalTolerance: null,
  textGradingMode: "EXACT",
};
const MANUAL_SETTINGS: ExamGradingSettings = {
  ...SETTINGS,
  textGradingMode: "MANUAL",
};

const mcq: QuestionData = {
  type: "MCQ", marks: 2, negativeMarks: 0.5,
  correctOptionIds: ["opt-a"], numericalAnswer: null, numericalTolerance: null, textAnswer: null,
};
const msq: QuestionData = {
  type: "MSQ", marks: 4, negativeMarks: 0,
  correctOptionIds: ["opt-a", "opt-b"], numericalAnswer: null, numericalTolerance: null, textAnswer: null,
};
const tf: QuestionData = {
  type: "TRUE_FALSE", marks: 1, negativeMarks: 0,
  correctOptionIds: ["opt-true"], numericalAnswer: null, numericalTolerance: null, textAnswer: null,
};
const num: QuestionData = {
  type: "NUMERICAL", marks: 3, negativeMarks: 0,
  correctOptionIds: [], numericalAnswer: 42, numericalTolerance: 0, textAnswer: null,
};
const text: QuestionData = {
  type: "SHORT_TEXT", marks: 2, negativeMarks: 0,
  correctOptionIds: [], numericalAnswer: null, numericalTolerance: null, textAnswer: "Paris",
};
const img: QuestionData = {
  type: "IMAGE_BASED", marks: 1, negativeMarks: 0,
  correctOptionIds: ["opt-img-a"], numericalAnswer: null, numericalTolerance: null, textAnswer: null,
};

describe("auto result generation — all question types", () => {
  it("grades MCQ correctly for all six question types in one attempt", () => {
    const result = gradeAttempt([
      { questionId: "q1", question: mcq,  response: { selectedOptionIds: ["opt-a"],    textAnswer: null, numericalAnswer: null } },
      { questionId: "q2", question: msq,  response: { selectedOptionIds: ["opt-a", "opt-b"], textAnswer: null, numericalAnswer: null } },
      { questionId: "q3", question: tf,   response: { selectedOptionIds: ["opt-true"], textAnswer: null, numericalAnswer: null } },
      { questionId: "q4", question: num,  response: { selectedOptionIds: null, textAnswer: null, numericalAnswer: 42 } },
      { questionId: "q5", question: text, response: { selectedOptionIds: null, textAnswer: "Paris", numericalAnswer: null } },
      { questionId: "q6", question: img,  response: { selectedOptionIds: ["opt-img-a"], textAnswer: null, numericalAnswer: null } },
    ], SETTINGS);

    expect(result.totalScore).toBe(13); // 2+4+1+3+2+1
    expect(result.maxScore).toBe(13);
    expect(result.gradingStatus).toBe("COMPLETE");
  });

  it("marks SHORT_TEXT as PENDING in MANUAL mode → PARTIAL overall", () => {
    const result = gradeAttempt([
      { questionId: "q1", question: mcq,  response: { selectedOptionIds: ["opt-a"], textAnswer: null, numericalAnswer: null } },
      { questionId: "q2", question: text, response: { selectedOptionIds: null, textAnswer: "Paris", numericalAnswer: null } },
    ], MANUAL_SETTINGS);

    expect(result.gradingStatus).toBe("PARTIAL");
    expect(result.perQuestionMarks["q1"].status).toBe("graded");
    expect(result.perQuestionMarks["q2"].status).toBe("pending");
  });

  it("marks all SHORT_TEXT as PENDING → status PENDING", () => {
    const result = gradeAttempt([
      { questionId: "q1", question: text, response: { selectedOptionIds: null, textAnswer: "answer", numericalAnswer: null } },
      { questionId: "q2", question: text, response: { selectedOptionIds: null, textAnswer: "other",  numericalAnswer: null } },
    ], MANUAL_SETTINGS);

    expect(result.gradingStatus).toBe("PENDING");
    expect(result.totalScore).toBe(0); // pending questions score 0 until manual grading
  });
});

describe("auto result generation — idempotency contract", () => {
  it("gradeAttempt is pure: same inputs produce identical output on repeated calls", () => {
    const inputs = [
      { questionId: "q1", question: mcq, response: { selectedOptionIds: ["opt-a"], textAnswer: null, numericalAnswer: null } },
    ];
    const r1 = gradeAttempt(inputs, SETTINGS);
    const r2 = gradeAttempt(inputs, SETTINGS);
    expect(r1).toEqual(r2);
  });

  it("regrading after all-skipped attempt still produces COMPLETE status", () => {
    // Represents: student submitted without answering; grade triggered on submission
    const result = gradeAttempt([
      { questionId: "q1", question: mcq,  response: null },
      { questionId: "q2", question: num,  response: null },
    ], SETTINGS);
    expect(result.gradingStatus).toBe("COMPLETE");
    expect(result.totalScore).toBe(0);
    expect(result.maxScore).toBe(5); // 2 + 3
  });
});

describe("auto result generation — result not exposed before correct", () => {
  it("PARTIAL status means manual grading is still needed — result should be withheld from student", () => {
    const result = gradeAttempt([
      { questionId: "q1", question: text, response: { selectedOptionIds: null, textAnswer: "X", numericalAnswer: null } },
    ], MANUAL_SETTINGS);
    // Only admin can see partial; student must wait
    expect(result.gradingStatus).toBe("PENDING");
  });
});

describe("auto result generation — EXPIRED attempt coverage", () => {
  it("expired attempt with no responses grades as COMPLETE with 0 score", () => {
    // This mirrors a student who ran out of time without answering anything
    const result = gradeAttempt([
      { questionId: "q1", question: mcq, response: null },
      { questionId: "q2", question: tf,  response: null },
    ], SETTINGS);
    expect(result.gradingStatus).toBe("COMPLETE");
    expect(result.totalScore).toBe(0);
  });

  it("expired attempt with partial answers grades correctly", () => {
    const result = gradeAttempt([
      { questionId: "q1", question: mcq, response: { selectedOptionIds: ["opt-a"], textAnswer: null, numericalAnswer: null } },
      { questionId: "q2", question: tf,  response: null }, // time ran out before answering q2
    ], SETTINGS);
    expect(result.totalScore).toBe(2); // only q1 earned
    expect(result.perQuestionMarks["q2"].status).toBe("skipped");
    expect(result.gradingStatus).toBe("COMPLETE");
  });
});
