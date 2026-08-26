import { describe, it, expect } from "vitest";
import { StudentIdentitySchema } from "@/lib/validation/student";

describe("Student identity validation", () => {
  it("accepts a valid 9-digit ID and matching email", () => {
    const result = StudentIdentitySchema.safeParse({
      name: "Rahul Sharma",
      studentId: "202301001",
      email: "202301001@dau.ac.in",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a student ID that is not exactly 9 digits", () => {
    const result = StudentIdentitySchema.safeParse({
      name: "Rahul Sharma",
      studentId: "20230100",
      email: "20230100@dau.ac.in",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an email from a different domain", () => {
    const result = StudentIdentitySchema.safeParse({
      name: "Rahul Sharma",
      studentId: "202301001",
      email: "202301001@gmail.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when email does not match student ID", () => {
    const result = StudentIdentitySchema.safeParse({
      name: "Rahul Sharma",
      studentId: "202301001",
      email: "999999999@dau.ac.in",
    });
    expect(result.success).toBe(false);
  });

  it("rejects alphabets in student ID", () => {
    const result = StudentIdentitySchema.safeParse({
      name: "Rahul Sharma",
      studentId: "20230100A",
      email: "20230100A@dau.ac.in",
    });
    expect(result.success).toBe(false);
  });
});

describe("Admin validation", () => {
  it("validates strong password requirements", async () => {
    const { CreateAdminSchema } = await import("@/lib/validation/admin");
    expect(CreateAdminSchema.safeParse({
      email: "admin@test.com",
      name: "Test Admin",
      password: "Passw0rd",
    }).success).toBe(true);

    expect(CreateAdminSchema.safeParse({
      email: "admin@test.com",
      name: "Test Admin",
      password: "password",  // no uppercase, no number
    }).success).toBe(false);

    expect(CreateAdminSchema.safeParse({
      email: "admin@test.com",
      name: "Test Admin",
      password: "short1A",  // too short
    }).success).toBe(false);
  });
});
