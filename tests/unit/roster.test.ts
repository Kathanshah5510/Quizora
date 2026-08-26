import { describe, it, expect } from "vitest";
import { parseRosterCSV } from "@/lib/utils";
import { StudentIdentitySchema } from "@/lib/validation/student";

describe("parseRosterCSV", () => {
  it("parses a simple CSV without header", () => {
    const csv = "202301001,Rahul Sharma,202301001@dau.ac.in\n202301002,Priya Patel,202301002@dau.ac.in";
    const rows = parseRosterCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ studentId: "202301001", name: "Rahul Sharma", email: "202301001@dau.ac.in" });
  });

  it("skips the header row when first cell is not a 9-digit number", () => {
    const csv = "student_id,name,email\n202301001,Rahul Sharma,202301001@dau.ac.in";
    const rows = parseRosterCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].studentId).toBe("202301001");
  });

  it("handles Windows-style CRLF line endings", () => {
    const csv = "202301001,Rahul Sharma,202301001@dau.ac.in\r\n202301002,Priya Patel,202301002@dau.ac.in";
    expect(parseRosterCSV(csv)).toHaveLength(2);
  });

  it("strips surrounding quotes from values", () => {
    const csv = '"202301001","Rahul Sharma","202301001@dau.ac.in"';
    const rows = parseRosterCSV(csv);
    expect(rows[0].studentId).toBe("202301001");
    expect(rows[0].name).toBe("Rahul Sharma");
  });

  it("ignores empty lines", () => {
    const csv = "202301001,Rahul Sharma,202301001@dau.ac.in\n\n202301002,Priya Patel,202301002@dau.ac.in\n";
    expect(parseRosterCSV(csv)).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(parseRosterCSV("")).toHaveLength(0);
    expect(parseRosterCSV("   ")).toHaveLength(0);
  });

  it("returns empty array for header-only CSV", () => {
    const rows = parseRosterCSV("student_id,name,email");
    expect(rows).toHaveLength(0);
  });

  it("filters rows where studentId is empty", () => {
    const csv = ",No ID,noid@dau.ac.in\n202301001,Valid Student,202301001@dau.ac.in";
    const rows = parseRosterCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].studentId).toBe("202301001");
  });
});

describe("StudentIdentitySchema (roster context)", () => {
  it("validates a correctly formatted roster entry", () => {
    const result = StudentIdentitySchema.safeParse({
      studentId: "202301001",
      name: "Rahul Sharma",
      email: "202301001@dau.ac.in",
    });
    expect(result.success).toBe(true);
  });

  it("rejects studentId with fewer than 9 digits", () => {
    const result = StudentIdentitySchema.safeParse({
      studentId: "20230100",
      name: "Rahul Sharma",
      email: "20230100@dau.ac.in",
    });
    expect(result.success).toBe(false);
  });

  it("rejects studentId with more than 9 digits", () => {
    const result = StudentIdentitySchema.safeParse({
      studentId: "2023010011",
      name: "Rahul Sharma",
      email: "2023010011@dau.ac.in",
    });
    expect(result.success).toBe(false);
  });

  it("rejects email that does not match studentId", () => {
    const result = StudentIdentitySchema.safeParse({
      studentId: "202301001",
      name: "Rahul Sharma",
      email: "202301002@dau.ac.in",
    });
    expect(result.success).toBe(false);
  });

  it("rejects email from wrong domain", () => {
    const result = StudentIdentitySchema.safeParse({
      studentId: "202301001",
      name: "Rahul Sharma",
      email: "202301001@gmail.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name shorter than 2 characters", () => {
    const result = StudentIdentitySchema.safeParse({
      studentId: "202301001",
      name: "A",
      email: "202301001@dau.ac.in",
    });
    expect(result.success).toBe(false);
  });
});
