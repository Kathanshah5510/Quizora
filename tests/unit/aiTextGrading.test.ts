import { describe, it, expect, vi, afterEach } from "vitest";
import {
  gradeTextWithAI,
  AIGradingNotConfiguredError,
  AIGradingError,
} from "@/lib/ai/gradeText";

// ─── Mocking helpers ──────────────────────────────────────────────────────────

function mockGeminiResponse(jsonPayload: object, status = 200) {
  const responseBody = {
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify(jsonPayload) }],
        },
      },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(responseBody),
      text: () => Promise.resolve(JSON.stringify(responseBody)),
    })
  );
}

function mockGeminiTextResponse(text: string, status = 200) {
  const responseBody = {
    candidates: [{ content: { parts: [{ text }] } }],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(responseBody),
      text: () => Promise.resolve(JSON.stringify(responseBody)),
    })
  );
}

function mockGeminiFetchError(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      text: () => Promise.resolve("API error"),
      json: () => Promise.resolve({}),
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

// ─── AIGradingNotConfiguredError ──────────────────────────────────────────────

describe("AI grading — configuration guard", () => {
  it("throws AIGradingNotConfiguredError when GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      gradeTextWithAI({
        questionText: "What is 2+2?",
        expectedAnswer: "4",
        studentAnswer: "4",
        maxMarks: 2,
      })
    ).rejects.toThrow(AIGradingNotConfiguredError);
  });
});

// ─── Successful grading ────────────────────────────────────────────────────────

describe("AI grading — successful responses", () => {
  it("returns suggestedScore, rationale, and model on a clean response", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-test";
    mockGeminiResponse({ score: 1.5, rationale: "Partially correct." });

    const result = await gradeTextWithAI({
      questionText: "Describe gradient descent.",
      expectedAnswer: "An optimisation algorithm.",
      studentAnswer: "It descends a gradient.",
      maxMarks: 2,
    });

    expect(result.suggestedScore).toBe(1.5);
    expect(result.rationale).toBe("Partially correct.");
    expect(result.model).toBe("gemini-test");
  });

  it("clamps score to maxMarks when AI returns a higher value", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGeminiResponse({ score: 99, rationale: "Full marks." });

    const result = await gradeTextWithAI({
      questionText: "Q",
      expectedAnswer: "A",
      studentAnswer: "A",
      maxMarks: 5,
    });

    expect(result.suggestedScore).toBe(5);
  });

  it("clamps score to 0 when AI returns a negative value", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGeminiResponse({ score: -3, rationale: "Wrong." });

    const result = await gradeTextWithAI({
      questionText: "Q",
      expectedAnswer: "A",
      studentAnswer: "wrong",
      maxMarks: 5,
    });

    expect(result.suggestedScore).toBe(0);
  });

  it("rounds score to 2 decimal places", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGeminiResponse({ score: 1.5678, rationale: "Close." });

    const result = await gradeTextWithAI({
      questionText: "Q",
      expectedAnswer: "A",
      studentAnswer: "close",
      maxMarks: 5,
    });

    expect(result.suggestedScore).toBe(1.57);
  });

  it("extracts JSON even when model wraps it in extra text", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGeminiTextResponse(
      'Here is the result:\n{"score": 3, "rationale": "Good answer."}\nEnd.'
    );

    const result = await gradeTextWithAI({
      questionText: "Q",
      expectedAnswer: "A",
      studentAnswer: "answer",
      maxMarks: 5,
    });

    expect(result.suggestedScore).toBe(3);
    expect(result.rationale).toBe("Good answer.");
  });

  it("handles no-answer (skipped) case — score should be 0", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGeminiResponse({ score: 0, rationale: "No answer provided." });

    const result = await gradeTextWithAI({
      questionText: "Q",
      expectedAnswer: "A",
      studentAnswer: "",
      maxMarks: 4,
    });

    expect(result.suggestedScore).toBe(0);
  });
});

// ─── Error conditions ─────────────────────────────────────────────────────────

describe("AI grading — error conditions", () => {
  it("throws AIGradingError on non-2xx API response", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGeminiFetchError(429);

    await expect(
      gradeTextWithAI({
        questionText: "Q",
        expectedAnswer: "A",
        studentAnswer: "A",
        maxMarks: 2,
      })
    ).rejects.toThrow(AIGradingError);
  });

  it("throws AIGradingError when response has no JSON", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGeminiTextResponse("I cannot grade this.");

    await expect(
      gradeTextWithAI({
        questionText: "Q",
        expectedAnswer: "A",
        studentAnswer: "A",
        maxMarks: 2,
      })
    ).rejects.toThrow(AIGradingError);
  });

  it("throws AIGradingError when score field is non-numeric", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGeminiResponse({ score: "high", rationale: "Good." });

    await expect(
      gradeTextWithAI({
        questionText: "Q",
        expectedAnswer: "A",
        studentAnswer: "A",
        maxMarks: 2,
      })
    ).rejects.toThrow(AIGradingError);
  });
});
