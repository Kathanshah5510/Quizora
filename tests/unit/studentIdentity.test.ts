import { describe, it, expect } from "vitest";
import {
  isValidStudentId,
  isValidStudentEmail,
  validateIdentityFormat,
} from "@/lib/exam/studentIdentity";

describe("isValidStudentId", () => {
  it("accepts a 9-digit numeric string", () => {
    expect(isValidStudentId("202301001")).toBe(true);
    expect(isValidStudentId("000000000")).toBe(true);
    expect(isValidStudentId("999999999")).toBe(true);
  });

  it("rejects IDs shorter than 9 digits", () => {
    expect(isValidStudentId("20230100")).toBe(false);
    expect(isValidStudentId("1")).toBe(false);
    expect(isValidStudentId("")).toBe(false);
  });

  it("rejects IDs longer than 9 digits", () => {
    expect(isValidStudentId("2023010011")).toBe(false);
  });

  it("rejects IDs with non-numeric characters", () => {
    expect(isValidStudentId("20230100A")).toBe(false);
    expect(isValidStudentId("20230100 ")).toBe(false);
    expect(isValidStudentId("202-01001")).toBe(false);
  });

  it("trims leading/trailing whitespace before checking", () => {
    expect(isValidStudentId(" 202301001 ")).toBe(true);
  });
});

describe("isValidStudentEmail", () => {
  it("accepts {studentId}@dau.ac.in", () => {
    expect(isValidStudentEmail("202301001@dau.ac.in", "202301001")).toBe(true);
  });

  it("accepts mixed-case email (normalised to lowercase)", () => {
    expect(isValidStudentEmail("202301001@DAU.AC.IN", "202301001")).toBe(true);
  });

  it("rejects email with different student ID prefix", () => {
    expect(isValidStudentEmail("202301002@dau.ac.in", "202301001")).toBe(false);
  });

  it("rejects email with wrong domain", () => {
    expect(isValidStudentEmail("202301001@gmail.com", "202301001")).toBe(false);
    expect(isValidStudentEmail("202301001@dau.edu.in", "202301001")).toBe(false);
  });

  it("rejects email with extra characters", () => {
    expect(isValidStudentEmail("x202301001@dau.ac.in", "202301001")).toBe(false);
  });

  it("trims whitespace before checking", () => {
    expect(isValidStudentEmail(" 202301001@dau.ac.in ", "202301001")).toBe(true);
  });
});

describe("validateIdentityFormat", () => {
  const valid = { studentId: "202301001", email: "202301001@dau.ac.in", name: "Rahul Sharma" };

  it("returns null for a fully valid input", () => {
    expect(validateIdentityFormat(valid)).toBeNull();
  });

  it("returns INVALID_STUDENT_ID for bad ID", () => {
    expect(validateIdentityFormat({ ...valid, studentId: "12345" })).toBe("INVALID_STUDENT_ID");
  });

  it("returns INVALID_EMAIL for mismatched email", () => {
    expect(validateIdentityFormat({ ...valid, email: "999999999@dau.ac.in" })).toBe("INVALID_EMAIL");
  });

  it("returns INVALID_STUDENT_ID when name is empty", () => {
    expect(validateIdentityFormat({ ...valid, name: "   " })).toBe("INVALID_STUDENT_ID");
  });

  it("prioritises INVALID_STUDENT_ID over INVALID_EMAIL", () => {
    expect(
      validateIdentityFormat({ ...valid, studentId: "abc", email: "abc@dau.ac.in" })
    ).toBe("INVALID_STUDENT_ID");
  });
});
