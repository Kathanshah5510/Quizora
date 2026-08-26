import { describe, it, expect } from "vitest";
import {
  validatePublish,
  validateUnpublish,
  validateClose,
  validateReopen,
  describeAvailability,
} from "@/lib/services/exam-lifecycle";

const baseExam = {
  title: "IE403 — Quiz 1",
  instructorName: "Prof. Arunava Chakravarty",
  durationMinutes: 60,
};

describe("validatePublish", () => {
  it("allows publishing a valid DRAFT exam", () => {
    expect(validatePublish({ ...baseExam, status: "DRAFT" })).toBeNull();
  });

  it("blocks publishing a non-DRAFT exam", () => {
    expect(validatePublish({ ...baseExam, status: "PUBLISHED" })).toMatch(/draft/i);
    expect(validatePublish({ ...baseExam, status: "CLOSED" })).toMatch(/draft/i);
  });

  it("blocks if title is missing or too short", () => {
    expect(validatePublish({ ...baseExam, status: "DRAFT", title: "" })).toMatch(/title/i);
    expect(validatePublish({ ...baseExam, status: "DRAFT", title: "A" })).toMatch(/title/i);
  });

  it("blocks if instructorName is missing or too short", () => {
    expect(validatePublish({ ...baseExam, status: "DRAFT", instructorName: "" })).toMatch(/instructor/i);
    expect(validatePublish({ ...baseExam, status: "DRAFT", instructorName: "X" })).toMatch(/instructor/i);
  });

  it("blocks if durationMinutes is 0", () => {
    expect(validatePublish({ ...baseExam, status: "DRAFT", durationMinutes: 0 })).toMatch(/duration/i);
  });
});

describe("validateUnpublish", () => {
  it("allows unpublishing a PUBLISHED exam with no attempts", () => {
    expect(validateUnpublish({ ...baseExam, status: "PUBLISHED", attemptCount: 0 })).toBeNull();
  });

  it("blocks unpublishing a DRAFT exam", () => {
    expect(validateUnpublish({ ...baseExam, status: "DRAFT", attemptCount: 0 })).toMatch(/published/i);
  });

  it("blocks unpublishing if there are attempts", () => {
    expect(validateUnpublish({ ...baseExam, status: "PUBLISHED", attemptCount: 5 })).toMatch(/attempt/i);
  });
});

describe("validateClose", () => {
  it("allows closing a PUBLISHED exam", () => {
    expect(validateClose({ ...baseExam, status: "PUBLISHED" })).toBeNull();
  });

  it("allows closing an ACTIVE exam", () => {
    expect(validateClose({ ...baseExam, status: "ACTIVE" })).toBeNull();
  });

  it("blocks closing a DRAFT exam", () => {
    expect(validateClose({ ...baseExam, status: "DRAFT" })).toMatch(/published or active/i);
  });

  it("blocks closing an already CLOSED exam", () => {
    expect(validateClose({ ...baseExam, status: "CLOSED" })).toMatch(/published or active/i);
  });
});

describe("validateReopen", () => {
  it("allows reopening a CLOSED exam", () => {
    expect(validateReopen({ ...baseExam, status: "CLOSED" })).toBeNull();
  });

  it("blocks reopening a non-CLOSED exam", () => {
    expect(validateReopen({ ...baseExam, status: "DRAFT" })).toMatch(/closed/i);
    expect(validateReopen({ ...baseExam, status: "PUBLISHED" })).toMatch(/closed/i);
  });
});

describe("describeAvailability", () => {
  const past = new Date(Date.now() - 1000 * 60 * 60);
  const future = new Date(Date.now() + 1000 * 60 * 60);

  it("describes a DRAFT exam", () => {
    const { message, warning } = describeAvailability("DRAFT", null, null);
    expect(message).toMatch(/not yet published/i);
    expect(warning).toBe(false);
  });

  it("warns when PUBLISHED but availability window has ended", () => {
    const { warning } = describeAvailability("PUBLISHED", past, past);
    expect(warning).toBe(true);
  });

  it("reports no warning when PUBLISHED and within window", () => {
    const { warning } = describeAvailability("PUBLISHED", past, future);
    expect(warning).toBe(false);
  });

  it("describes a CLOSED exam without warning", () => {
    const { message, warning } = describeAvailability("CLOSED", null, null);
    expect(message).toMatch(/closed/i);
    expect(warning).toBe(false);
  });
});
