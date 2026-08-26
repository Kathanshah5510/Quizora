import { describe, it, expect } from "vitest";
import { CreateCourseSchema, UpdateCourseSchema } from "@/lib/validation/course";

describe("CreateCourseSchema", () => {
  it("accepts valid input and uppercases code", () => {
    const result = CreateCourseSchema.safeParse({
      name: "Machine Learning",
      code: "ie403",
      description: "Intro to ML",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("IE403");
      expect(result.data.name).toBe("Machine Learning");
    }
  });

  it("rejects name shorter than 2 characters", () => {
    const result = CreateCourseSchema.safeParse({ name: "A", code: "IE403" });
    expect(result.success).toBe(false);
  });

  it("rejects missing code", () => {
    const result = CreateCourseSchema.safeParse({ name: "Machine Learning", code: "" });
    expect(result.success).toBe(false);
  });

  it("rejects code with special characters", () => {
    const result = CreateCourseSchema.safeParse({ name: "Machine Learning", code: "IE-403" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/letters and numbers/);
    }
  });

  it("rejects code longer than 20 characters", () => {
    const result = CreateCourseSchema.safeParse({
      name: "Machine Learning",
      code: "AVERYLONGCODETHATEXCEEDSLIMIT",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const result = CreateCourseSchema.safeParse({
      name: "Machine Learning",
      code: "IE403",
      description: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts course without description", () => {
    const result = CreateCourseSchema.safeParse({ name: "Machine Learning", code: "IE403" });
    expect(result.success).toBe(true);
  });
});

describe("UpdateCourseSchema", () => {
  it("accepts partial update with only name", () => {
    const result = UpdateCourseSchema.safeParse({ name: "Updated ML" });
    expect(result.success).toBe(true);
  });

  it("accepts isActive false for archiving", () => {
    const result = UpdateCourseSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });

  it("accepts empty object (no-op update)", () => {
    const result = UpdateCourseSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
