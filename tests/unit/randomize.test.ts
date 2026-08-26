import { describe, it, expect } from "vitest";
import { shuffle, buildRandomizedOrders } from "@/lib/exam/randomize";

const QUESTIONS = [
  { id: "q1", displayOrder: 1, optionIds: ["o1a", "o1b", "o1c"] },
  { id: "q2", displayOrder: 2, optionIds: ["o2a", "o2b"] },
  { id: "q3", displayOrder: 3, optionIds: ["o3a", "o3b", "o3c", "o3d"] },
];

describe("shuffle", () => {
  it("returns array of same length", () => {
    expect(shuffle([1, 2, 3, 4, 5])).toHaveLength(5);
  });

  it("contains all original elements", () => {
    const original = [1, 2, 3, 4, 5];
    const result = shuffle(original);
    expect(result.sort()).toEqual([...original].sort());
  });

  it("does not mutate the original array", () => {
    const original = [1, 2, 3];
    const copy = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });

  it("handles empty array", () => {
    expect(shuffle([])).toEqual([]);
  });

  it("handles single element", () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

describe("buildRandomizedOrders — no randomization", () => {
  it("preserves displayOrder for questions", () => {
    const { questionOrder } = buildRandomizedOrders(QUESTIONS, false, false);
    expect(questionOrder).toEqual(["q1", "q2", "q3"]);
  });

  it("preserves option order when randomizeOptions=false", () => {
    const { optionOrders } = buildRandomizedOrders(QUESTIONS, false, false);
    expect(optionOrders["q1"]).toEqual(["o1a", "o1b", "o1c"]);
    expect(optionOrders["q2"]).toEqual(["o2a", "o2b"]);
    expect(optionOrders["q3"]).toEqual(["o3a", "o3b", "o3c", "o3d"]);
  });

  it("includes all questions in optionOrders map", () => {
    const { optionOrders } = buildRandomizedOrders(QUESTIONS, false, false);
    expect(Object.keys(optionOrders)).toHaveLength(3);
  });
});

describe("buildRandomizedOrders — with randomization", () => {
  it("question IDs contain all original IDs when randomized", () => {
    const { questionOrder } = buildRandomizedOrders(QUESTIONS, true, false);
    expect(questionOrder.sort()).toEqual(["q1", "q2", "q3"]);
  });

  it("option IDs contain all original options when randomized", () => {
    const { optionOrders } = buildRandomizedOrders(QUESTIONS, false, true);
    expect(optionOrders["q1"].sort()).toEqual(["o1a", "o1b", "o1c"]);
    expect(optionOrders["q2"].sort()).toEqual(["o2a", "o2b"]);
  });

  it("question order length matches input", () => {
    const { questionOrder } = buildRandomizedOrders(QUESTIONS, true, true);
    expect(questionOrder).toHaveLength(3);
  });
});

describe("buildRandomizedOrders — edge cases", () => {
  it("handles empty question list", () => {
    const { questionOrder, optionOrders } = buildRandomizedOrders([], false, false);
    expect(questionOrder).toEqual([]);
    expect(optionOrders).toEqual({});
  });

  it("handles questions with no options", () => {
    const noOpts = [{ id: "q1", displayOrder: 1, optionIds: [] }];
    const { optionOrders } = buildRandomizedOrders(noOpts, false, true);
    expect(optionOrders["q1"]).toEqual([]);
  });
});
