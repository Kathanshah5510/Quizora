import { describe, it, expect } from "vitest";
import { CreateExamSchema, UpdateExamSchema } from "@/lib/validation/exam";

const baseValid = {
  courseId: "some-course-id",
  title: "IE403 — Quiz 1",
  instructorName: "Prof. Arunava Chakravarty",
  durationMinutes: 60,
  taNames: ["TA One", "TA Two"],
  timerMode: "WHOLE_QUIZ" as const,
  attemptsAllowed: 1,
  randomizeQuestions: false,
  randomizeOptions: false,
  allowBacktracking: true,
  allowExternalStudents: false,
  continueAfterAvailability: false,
  fullScreenRequired: false,
  defaultMarks: 1,
  defaultNegativeMarks: 0,
  msqGradingPolicy: "STRICT" as const,
  textGradingMode: "EXACT" as const,
  resultRelease: "AUTO" as const,
};

describe("CreateExamSchema", () => {
  it("accepts a valid minimal exam", () => {
    const result = CreateExamSchema.safeParse({
      courseId: "abc",
      title: "Quiz 1",
      instructorName: "Prof. Test",
      durationMinutes: 60,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a fully specified exam", () => {
    const result = CreateExamSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("rejects missing courseId", () => {
    const { courseId: _, ...rest } = baseValid;
    const result = CreateExamSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects title shorter than 2 characters", () => {
    const result = CreateExamSchema.safeParse({ ...baseValid, title: "Q" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/2 characters/);
    }
  });

  it("rejects duration of 0", () => {
    const result = CreateExamSchema.safeParse({ ...baseValid, durationMinutes: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects duration over 600 minutes", () => {
    const result = CreateExamSchema.safeParse({ ...baseValid, durationMinutes: 601 });
    expect(result.success).toBe(false);
  });

  it("rejects PER_QUESTION timer without perQuestionSeconds", () => {
    const result = CreateExamSchema.safeParse({
      ...baseValid,
      timerMode: "PER_QUESTION",
      perQuestionSeconds: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain("perQuestionSeconds");
    }
  });

  it("accepts PER_QUESTION timer with perQuestionSeconds", () => {
    const result = CreateExamSchema.safeParse({
      ...baseValid,
      timerMode: "PER_QUESTION",
      perQuestionSeconds: 90,
    });
    expect(result.success).toBe(true);
  });

  it("rejects attemptsAllowed of 0", () => {
    const result = CreateExamSchema.safeParse({ ...baseValid, attemptsAllowed: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative defaultNegativeMarks", () => {
    const result = CreateExamSchema.safeParse({ ...baseValid, defaultNegativeMarks: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects availabilityEnd before availabilityStart", () => {
    const result = CreateExamSchema.safeParse({
      ...baseValid,
      availabilityStart: "2024-01-20T10:00",
      availabilityEnd: "2024-01-20T09:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain("availabilityEnd");
    }
  });

  it("accepts availabilityEnd after availabilityStart", () => {
    const result = CreateExamSchema.safeParse({
      ...baseValid,
      availabilityStart: "2024-01-20T09:00",
      availabilityEnd: "2024-01-20T11:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid timerMode", () => {
    const result = CreateExamSchema.safeParse({ ...baseValid, timerMode: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid resultRelease", () => {
    const result = CreateExamSchema.safeParse({ ...baseValid, resultRelease: "IMMEDIATE" });
    expect(result.success).toBe(false);
  });
});

describe("UpdateExamSchema", () => {
  it("accepts an empty object (no-op)", () => {
    expect(UpdateExamSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial update with only title", () => {
    const result = UpdateExamSchema.safeParse({ title: "Updated Title" });
    expect(result.success).toBe(true);
  });

  it("accepts slug update", () => {
    const result = UpdateExamSchema.safeParse({ slug: "my-new-slug" });
    expect(result.success).toBe(true);
  });

  it("rejects availabilityEnd before start in partial update", () => {
    const result = UpdateExamSchema.safeParse({
      availabilityStart: "2024-01-20T10:00",
      availabilityEnd: "2024-01-20T09:00",
    });
    expect(result.success).toBe(false);
  });
});
