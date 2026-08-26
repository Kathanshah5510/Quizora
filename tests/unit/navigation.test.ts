import { describe, it, expect } from "vitest";
import { validateNavigation, NavigationCheck } from "@/lib/exam/navigation";

const BASE: NavigationCheck = {
  fromIndex: 2,
  toIndex: 3,
  totalQuestions: 10,
  allowBacktracking: true,
};

describe("validateNavigation", () => {
  it("returns null for valid forward navigation", () => {
    expect(validateNavigation(BASE)).toBeNull();
  });

  it("returns null for valid backward navigation when allowed", () => {
    expect(validateNavigation({ ...BASE, toIndex: 1 })).toBeNull();
  });

  it("returns BACKWARD_NOT_ALLOWED when backtracking disabled and toIndex < fromIndex", () => {
    expect(
      validateNavigation({ ...BASE, toIndex: 1, allowBacktracking: false })
    ).toBe("BACKWARD_NOT_ALLOWED");
  });

  it("returns null for forward navigation even when allowBacktracking=false", () => {
    expect(
      validateNavigation({ ...BASE, toIndex: 5, allowBacktracking: false })
    ).toBeNull();
  });

  it("returns INDEX_OUT_OF_RANGE when toIndex >= totalQuestions", () => {
    expect(validateNavigation({ ...BASE, toIndex: 10 })).toBe("INDEX_OUT_OF_RANGE");
    expect(validateNavigation({ ...BASE, toIndex: 999 })).toBe("INDEX_OUT_OF_RANGE");
  });

  it("returns INDEX_OUT_OF_RANGE when toIndex < 0", () => {
    expect(validateNavigation({ ...BASE, toIndex: -1 })).toBe("INDEX_OUT_OF_RANGE");
  });

  it("returns SAME_INDEX when fromIndex === toIndex", () => {
    expect(validateNavigation({ ...BASE, toIndex: BASE.fromIndex })).toBe("SAME_INDEX");
  });

  it("INDEX_OUT_OF_RANGE takes priority over BACKWARD_NOT_ALLOWED", () => {
    // toIndex=-1 is both out of range and backward
    expect(
      validateNavigation({ ...BASE, toIndex: -1, allowBacktracking: false })
    ).toBe("INDEX_OUT_OF_RANGE");
  });

  it("allows navigation to first question (index 0)", () => {
    expect(validateNavigation({ ...BASE, fromIndex: 5, toIndex: 0, allowBacktracking: true })).toBeNull();
  });

  it("allows navigation to last question", () => {
    expect(validateNavigation({ ...BASE, toIndex: 9 })).toBeNull();
  });
});
