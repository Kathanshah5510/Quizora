import { describe, it, expect } from "vitest";
import { CreateQuestionSchema, UpdateQuestionSchema, ReorderQuestionsSchema } from "@/lib/validation/question";

const tfOptions = [
  { text: "True", isCorrect: true, displayOrder: 0 },
  { text: "False", isCorrect: false, displayOrder: 1 },
];

const mcqOptions = [
  { text: "Option A", isCorrect: true, displayOrder: 0 },
  { text: "Option B", isCorrect: false, displayOrder: 1 },
  { text: "Option C", isCorrect: false, displayOrder: 2 },
];

const msqOptions = [
  { text: "Option A", isCorrect: true, displayOrder: 0 },
  { text: "Option B", isCorrect: true, displayOrder: 1 },
  { text: "Option C", isCorrect: false, displayOrder: 2 },
];

// ─── MCQ ──────────────────────────────────────────────────────────────────────

describe("CreateQuestionSchema — MCQ", () => {
  it("accepts a valid MCQ question", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MCQ",
      text: "Which algorithm is used for classification?",
      marks: 2,
      negativeMarks: 0.5,
      options: mcqOptions,
    });
    expect(result.success).toBe(true);
  });

  it("rejects MCQ with fewer than 2 options", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MCQ",
      text: "Question?",
      marks: 1,
      negativeMarks: 0,
      options: [{ text: "Only option", isCorrect: true, displayOrder: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects MCQ with 0 correct options", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MCQ",
      text: "Question?",
      marks: 1,
      negativeMarks: 0,
      options: [
        { text: "A", isCorrect: false, displayOrder: 0 },
        { text: "B", isCorrect: false, displayOrder: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects MCQ with 2 correct options", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MCQ",
      text: "Question?",
      marks: 1,
      negativeMarks: 0,
      options: [
        { text: "A", isCorrect: true, displayOrder: 0 },
        { text: "B", isCorrect: true, displayOrder: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects MCQ with negative marks < 0", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MCQ",
      text: "Question?",
      marks: 1,
      negativeMarks: -1,
      options: mcqOptions,
    });
    expect(result.success).toBe(false);
  });

  it("rejects MCQ with marks of 0", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MCQ",
      text: "Question?",
      marks: 0,
      negativeMarks: 0,
      options: mcqOptions,
    });
    expect(result.success).toBe(false);
  });
});

// ─── MSQ ──────────────────────────────────────────────────────────────────────

describe("CreateQuestionSchema — MSQ", () => {
  it("accepts a valid MSQ question", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MSQ",
      text: "Which are supervised learning algorithms?",
      marks: 3,
      negativeMarks: 0,
      options: msqOptions,
    });
    expect(result.success).toBe(true);
  });

  it("accepts MSQ with all options correct", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MSQ",
      text: "Select all valid options",
      marks: 2,
      negativeMarks: 0,
      options: [
        { text: "A", isCorrect: true, displayOrder: 0 },
        { text: "B", isCorrect: true, displayOrder: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects MSQ with no correct options", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MSQ",
      text: "Question?",
      marks: 2,
      negativeMarks: 0,
      options: [
        { text: "A", isCorrect: false, displayOrder: 0 },
        { text: "B", isCorrect: false, displayOrder: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ─── TRUE_FALSE ───────────────────────────────────────────────────────────────

describe("CreateQuestionSchema — TRUE_FALSE", () => {
  it("accepts a valid True/False question", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "TRUE_FALSE",
      text: "Linear regression is a supervised learning algorithm.",
      marks: 1,
      negativeMarks: 0,
      options: tfOptions,
    });
    expect(result.success).toBe(true);
  });

  it("rejects True/False with 3 options", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "TRUE_FALSE",
      text: "Question?",
      marks: 1,
      negativeMarks: 0,
      options: mcqOptions, // 3 options
    });
    expect(result.success).toBe(false);
  });

  it("rejects True/False with no correct option", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "TRUE_FALSE",
      text: "Question?",
      marks: 1,
      negativeMarks: 0,
      options: [
        { text: "True", isCorrect: false, displayOrder: 0 },
        { text: "False", isCorrect: false, displayOrder: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ─── NUMERICAL ────────────────────────────────────────────────────────────────

describe("CreateQuestionSchema — NUMERICAL", () => {
  it("accepts a valid numerical question", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "NUMERICAL",
      text: "What is the value of π to 2 decimal places?",
      marks: 2,
      negativeMarks: 0,
      numericalAnswer: 3.14,
      numericalTolerance: 0.01,
    });
    expect(result.success).toBe(true);
  });

  it("accepts numerical without tolerance (defaults to null)", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "NUMERICAL",
      text: "What is 2 + 2?",
      marks: 1,
      negativeMarks: 0,
      numericalAnswer: 4,
    });
    expect(result.success).toBe(true);
  });

  it("rejects numerical with no answer provided", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "NUMERICAL",
      text: "What is 2 + 2?",
      marks: 1,
      negativeMarks: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative numerical tolerance", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "NUMERICAL",
      text: "Question?",
      marks: 1,
      negativeMarks: 0,
      numericalAnswer: 5,
      numericalTolerance: -0.1,
    });
    expect(result.success).toBe(false);
  });
});

// ─── SHORT_TEXT ───────────────────────────────────────────────────────────────

describe("CreateQuestionSchema — SHORT_TEXT", () => {
  it("accepts a valid short text question", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "SHORT_TEXT",
      text: "What does SVM stand for?",
      marks: 1,
      negativeMarks: 0,
      textAnswer: "Support Vector Machine",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short text with no answer", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "SHORT_TEXT",
      text: "What does SVM stand for?",
      marks: 1,
      negativeMarks: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects short text with empty answer", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "SHORT_TEXT",
      text: "Question?",
      marks: 1,
      negativeMarks: 0,
      textAnswer: "   ",
    });
    expect(result.success).toBe(false);
  });
});

// ─── IMAGE_BASED ──────────────────────────────────────────────────────────────

describe("CreateQuestionSchema — IMAGE_BASED", () => {
  it("accepts an image-based question with options", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "IMAGE_BASED",
      text: "Based on the graph above, which algorithm has the lowest bias?",
      marks: 2,
      negativeMarks: 0.5,
      options: mcqOptions,
      mediaAssetId: "asset-id-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects image-based with no options", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "IMAGE_BASED",
      text: "Based on the image, select the correct answer.",
      marks: 2,
      negativeMarks: 0,
      options: [],
    });
    expect(result.success).toBe(false);
  });
});

// ─── ReorderQuestionsSchema ───────────────────────────────────────────────────

describe("ReorderQuestionsSchema", () => {
  it("accepts a valid reorder payload", () => {
    const result = ReorderQuestionsSchema.safeParse({
      questions: [
        { id: "q1", displayOrder: 0 },
        { id: "q2", displayOrder: 1 },
        { id: "q3", displayOrder: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty questions array", () => {
    const result = ReorderQuestionsSchema.safeParse({ questions: [] });
    expect(result.success).toBe(false);
  });
});

// ─── UpdateQuestionSchema ─────────────────────────────────────────────────────

describe("UpdateQuestionSchema", () => {
  it("accepts partial update with marks only", () => {
    const result = UpdateQuestionSchema.safeParse({ marks: 3 });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with text only", () => {
    const result = UpdateQuestionSchema.safeParse({ text: "Updated question text" });
    expect(result.success).toBe(true);
  });

  it("accepts update with new options", () => {
    const result = UpdateQuestionSchema.safeParse({
      options: mcqOptions,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty update object", () => {
    const result = UpdateQuestionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── Ordering invariants ──────────────────────────────────────────────────────

describe("Question ordering invariants", () => {
  it("ReorderQuestionsSchema validates unique IDs with ascending order", () => {
    const result = ReorderQuestionsSchema.safeParse({
      questions: [
        { id: "q1", displayOrder: 1 },
        { id: "q2", displayOrder: 2 },
        { id: "q3", displayOrder: 3 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("ReorderQuestionsSchema allows non-contiguous displayOrder values", () => {
    // The schema doesn't enforce contiguity — gaps are fine
    const result = ReorderQuestionsSchema.safeParse({
      questions: [
        { id: "q1", displayOrder: 10 },
        { id: "q2", displayOrder: 20 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("ReorderQuestionsSchema requires displayOrder >= 0", () => {
    const result = ReorderQuestionsSchema.safeParse({
      questions: [{ id: "q1", displayOrder: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it("CreateQuestionSchema defaults negativeMarks to 0", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "MCQ",
      text: "Question?",
      marks: 1,
      options: mcqOptions,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.negativeMarks).toBe(0);
    }
  });

  it("CreateQuestionSchema defaults options to empty array for non-option types", () => {
    const result = CreateQuestionSchema.safeParse({
      type: "NUMERICAL",
      text: "What is 2+2?",
      marks: 1,
      numericalAnswer: 4,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options).toEqual([]);
    }
  });
});
