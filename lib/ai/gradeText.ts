/**
 * AI-assisted text grading service.
 * Calls the configured AI provider to evaluate a SHORT_TEXT exam response.
 * Provider and model are fully configurable via environment variables.
 */

export interface TextGradeInput {
  questionText: string;
  expectedAnswer: string | null;
  studentAnswer: string;
  maxMarks: number;
}

export interface TextGradeResult {
  suggestedScore: number;
  rationale: string;
  model: string;
}

export class AIGradingNotConfiguredError extends Error {
  constructor() {
    super(
      "AI grading is not configured. Set GEMINI_API_KEY in environment variables."
    );
    this.name = "AIGradingNotConfiguredError";
  }
}

export class AIGradingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIGradingError";
  }
}

/**
 * Call the Gemini generateContent REST endpoint.
 * Returns the raw text of the first candidate part.
 */
async function callGemini(prompt: string): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIGradingNotConfiguredError();

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-exp";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.2, // low temperature for consistent grading
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new AIGradingError(`AI provider responded with ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new AIGradingError("AI provider returned an empty response");

  return { text, model };
}

/**
 * Grade a SHORT_TEXT answer using the configured AI provider.
 * Returns a suggested score (clamped to [0, maxMarks]) and a brief rationale.
 */
export async function gradeTextWithAI(
  input: TextGradeInput
): Promise<TextGradeResult> {
  const { questionText, expectedAnswer, studentAnswer, maxMarks } = input;

  const prompt = `You are an objective exam grader. Grade the following student answer and respond with ONLY valid JSON — no markdown, no explanation outside the JSON.

Question: ${questionText}
${expectedAnswer ? `Expected answer: ${expectedAnswer}` : "No specific expected answer — use your best academic judgment."}
Student's answer: ${studentAnswer || "(no answer provided)"}
Maximum marks: ${maxMarks}

Respond with exactly this JSON structure:
{"score": <number 0 to ${maxMarks}>, "rationale": "<1-2 sentence explanation>"}

Rules:
- score must be a number between 0 and ${maxMarks} inclusive, up to 2 decimal places
- award partial credit where the answer is partially correct
- be fair, objective, and consistent
- if the student left no answer, score must be 0`;

  const { text, model } = await callGemini(prompt);

  // Extract JSON from the response (handle cases where model adds extra text)
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new AIGradingError(
      `AI response did not contain valid JSON. Raw response: ${text.slice(0, 200)}`
    );
  }

  let parsed: { score: unknown; rationale: unknown };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new AIGradingError(`Failed to parse AI response as JSON: ${jsonMatch[0]}`);
  }

  const rawScore = Number(parsed.score);
  if (isNaN(rawScore)) {
    throw new AIGradingError(`AI returned a non-numeric score: ${parsed.score}`);
  }

  const suggestedScore = Math.round(Math.min(maxMarks, Math.max(0, rawScore)) * 100) / 100;
  const rationale = String(parsed.rationale ?? "").slice(0, 500);

  return { suggestedScore, rationale, model };
}
