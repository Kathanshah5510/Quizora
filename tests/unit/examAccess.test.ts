import { describe, it, expect } from "vitest";
import { checkExamAccess, canStartAttempt, ExamAccessInput } from "@/lib/exam/examAccess";

const NOW = new Date("2025-06-15T10:00:00Z");

const BASE: ExamAccessInput = {
  status: "PUBLISHED",
  availabilityStart: null,
  availabilityEnd: null,
  continueAfterAvailability: false,
};

describe("checkExamAccess", () => {
  it("returns DRAFT for draft exams", () => {
    expect(checkExamAccess({ ...BASE, status: "DRAFT" }, NOW)).toBe("DRAFT");
  });

  it("returns CLOSED for closed exams", () => {
    expect(checkExamAccess({ ...BASE, status: "CLOSED" }, NOW)).toBe("CLOSED");
  });

  it("returns ACCESSIBLE for published exam with no availability window", () => {
    expect(checkExamAccess(BASE, NOW)).toBe("ACCESSIBLE");
  });

  it("returns ACCESSIBLE for active exam with no availability window", () => {
    expect(checkExamAccess({ ...BASE, status: "ACTIVE" }, NOW)).toBe("ACCESSIBLE");
  });

  it("returns NOT_YET_AVAILABLE when before availabilityStart", () => {
    const exam: ExamAccessInput = {
      ...BASE,
      availabilityStart: new Date("2025-06-16T00:00:00Z"), // tomorrow
    };
    expect(checkExamAccess(exam, NOW)).toBe("NOT_YET_AVAILABLE");
  });

  it("returns ACCESSIBLE when exactly at availabilityStart", () => {
    const exam: ExamAccessInput = {
      ...BASE,
      availabilityStart: NOW,
    };
    expect(checkExamAccess(exam, NOW)).toBe("ACCESSIBLE");
  });

  it("returns ACCESSIBILITY_ENDED when after availabilityEnd and continueAfterAvailability=false", () => {
    const exam: ExamAccessInput = {
      ...BASE,
      availabilityEnd: new Date("2025-06-14T00:00:00Z"), // yesterday
      continueAfterAvailability: false,
    };
    expect(checkExamAccess(exam, NOW)).toBe("AVAILABILITY_ENDED");
  });

  it("returns ACCESSIBLE when after availabilityEnd but continueAfterAvailability=true", () => {
    const exam: ExamAccessInput = {
      ...BASE,
      availabilityEnd: new Date("2025-06-14T00:00:00Z"), // yesterday
      continueAfterAvailability: true,
    };
    expect(checkExamAccess(exam, NOW)).toBe("ACCESSIBLE");
  });

  it("returns ACCESSIBLE when within availability window", () => {
    const exam: ExamAccessInput = {
      ...BASE,
      availabilityStart: new Date("2025-06-14T00:00:00Z"), // yesterday
      availabilityEnd: new Date("2025-06-16T00:00:00Z"),   // tomorrow
    };
    expect(checkExamAccess(exam, NOW)).toBe("ACCESSIBLE");
  });

  it("CLOSED takes priority over availability window", () => {
    const exam: ExamAccessInput = {
      status: "CLOSED",
      availabilityStart: new Date("2025-06-14T00:00:00Z"),
      availabilityEnd: new Date("2025-06-16T00:00:00Z"),
      continueAfterAvailability: false,
    };
    expect(checkExamAccess(exam, NOW)).toBe("CLOSED");
  });
});

describe("canStartAttempt", () => {
  it("returns true only for ACCESSIBLE", () => {
    expect(canStartAttempt("ACCESSIBLE")).toBe(true);
    expect(canStartAttempt("DRAFT")).toBe(false);
    expect(canStartAttempt("CLOSED")).toBe(false);
    expect(canStartAttempt("NOT_YET_AVAILABLE")).toBe(false);
    expect(canStartAttempt("AVAILABILITY_ENDED")).toBe(false);
    expect(canStartAttempt("NOT_FOUND")).toBe(false);
  });
});
