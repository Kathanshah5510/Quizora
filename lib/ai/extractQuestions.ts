/**
 * AI-based question extraction from PDF documents.
 * Sends the PDF as base64 inline data to Gemini with a structured extraction prompt.
 * Returns an array of extracted questions for admin review before import.
 */

export interface ExtractedOption {
  text: string;
  isCorrect: boolean;
}

export interface ExtractedQuestion {
  type: "MCQ" | "MSQ" | "TRUE_FALSE" | "SHORT_TEXT" | "NUMERICAL";
  text: string;
  options: ExtractedOption[];
  marks: number;
  negativeMarks: number;
  numericalAnswer: number | null;
  numericalTolerance: number | null;
  textAnswer: string | null;
}

export interface ExtractResult {
  questions: ExtractedQuestion[];
  rawResponse: string;
}

export class QuestionExtractionNotConfiguredError extends Error {
  constructor() {
    super("Question extraction is not configured. Set GEMINI_API_KEY in environment variables.");
    this.name = "QuestionExtractionNotConfiguredError";
  }
}

export class QuestionExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionExtractionError";
  }
}

const EXTRACTION_PROMPT = `You are an expert exam question parser. Extract all questions from the provided document and return them as a single JSON array.

For each question, determine:
- type: "MCQ" (single correct), "MSQ" (multiple correct), "TRUE_FALSE", "SHORT_TEXT", or "NUMERICAL"
- text: the question text (clean, without option labels)
- options: array of {text, isCorrect} for MCQ/MSQ/TRUE_FALSE (empty array for SHORT_TEXT and NUMERICAL)
- marks: marks awarded (default 1 if not specified)
- negativeMarks: negative marks for wrong answer (default 0)
- numericalAnswer: numeric value for NUMERICAL questions (null otherwise)
- numericalTolerance: acceptable tolerance for NUMERICAL (null if not specified)
- textAnswer: expected answer for SHORT_TEXT (null for other types)

Rules:
- Extract EVERY question you find, in document order
- For MCQ/TRUE_FALSE: exactly one option has isCorrect: true
- For MSQ: multiple options have isCorrect: true
- For TRUE_FALSE: options must be [{text:"True",isCorrect:<bool>},{text:"False",isCorrect:<bool>}]
- If marks/negative marks are not specified, use 1 and 0 respectively
- Strip option labels (A, B, C, D, (a), (b), 1., 2., etc.) from option text
- Ignore page numbers, headers, footers, instructions, and blank lines
- If a correct answer is not clearly indicated, set all isCorrect to false

Respond with ONLY a valid JSON array — no markdown, no explanation, no code fences.

Format:
[
  {
    "type": "MCQ",
    "text": "Question text here",
    "options": [
      {"text": "Option A text", "isCorrect": false},
      {"text": "Option B text", "isCorrect": true}
    ],
    "marks": 1,
    "negativeMarks": 0,
    "numericalAnswer": null,
    "numericalTolerance": null,
    "textAnswer": null
  }
]`;

function normalizeType(raw: string): ExtractedQuestion["type"] | null {
  const map: Record<string, ExtractedQuestion["type"]> = {
    MCQ: "MCQ",
    MSQ: "MSQ",
    TRUE_FALSE: "TRUE_FALSE",
    "TRUE/FALSE": "TRUE_FALSE",
    SHORT_TEXT: "SHORT_TEXT",
    NUMERICAL: "NUMERICAL",
    NUMERIC: "NUMERICAL",
  };
  return map[String(raw).toUpperCase().trim()] ?? null;
}

function normalizeQuestion(raw: unknown): ExtractedQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;

  const type = normalizeType(String(q.type ?? ""));
  if (!type) return null;

  const text = String(q.text ?? "").trim();
  if (!text) return null;

  const marks = Math.max(0, Number(q.marks ?? 1));
  const negativeMarks = Math.max(0, Number(q.negativeMarks ?? 0));

  const rawOptions = Array.isArray(q.options) ? q.options : [];
  const options: ExtractedOption[] = rawOptions
    .map((o) => {
      if (!o || typeof o !== "object") return null;
      const opt = o as Record<string, unknown>;
      const optText = String(opt.text ?? "").trim();
      if (!optText) return null;
      return { text: optText, isCorrect: Boolean(opt.isCorrect) };
    })
    .filter((o): o is ExtractedOption => o !== null);

  // TRUE_FALSE: ensure exactly the two standard options
  if (type === "TRUE_FALSE" && options.length === 0) {
    options.push({ text: "True", isCorrect: false }, { text: "False", isCorrect: false });
  }

  return {
    type,
    text,
    options,
    marks,
    negativeMarks,
    numericalAnswer: q.numericalAnswer != null ? Number(q.numericalAnswer) : null,
    numericalTolerance: q.numericalTolerance != null ? Number(q.numericalTolerance) : null,
    textAnswer: q.textAnswer ? String(q.textAnswer).trim() : null,
  };
}

const TEXT_EXTRACTION_PROMPT = `You are an expert exam question parser. The provided content is a CSV, TSV, or plain-text file containing exam questions. Column names, order, and format may vary widely.

Intelligently identify and extract every question. Common patterns to recognize:
- Question column: "Question", "Q", "Statement", "Text", "Problem"
- Options: "Option A"/"A"/"Choice 1", "B"/"Choice 2", "option_a"/"option_b", etc.
- Answer/Correct: a letter (A/B/C/D), the option text itself, True/False, or a number
- Marks: "Marks", "Points", "Score" (default 1 if absent)
- Negative marks: "Negative", "NM", "Penalty" (default 0 if absent)

Infer question type from the data:
- Single letter answer (A, B, C, D) → MCQ
- Multiple letters (A|B or A,B) → MSQ
- True/False answer → TRUE_FALSE
- Numeric answer → NUMERICAL
- Free text answer → SHORT_TEXT

For each question output:
- type: "MCQ" | "MSQ" | "TRUE_FALSE" | "SHORT_TEXT" | "NUMERICAL"
- text: the question text (clean, no numbering)
- options: [{text, isCorrect}] for MCQ/MSQ/TRUE_FALSE; [] for NUMERICAL/SHORT_TEXT
- marks: number (default 1)
- negativeMarks: number (default 0)
- numericalAnswer: number | null
- numericalTolerance: number | null
- textAnswer: string | null

Rules:
- Skip header rows and blank rows
- Strip option labels (A., (a), 1., etc.) from option text before storing
- If answer is a letter, match it to the corresponding option (A=1st option, B=2nd, etc.)
- For MCQ / TRUE_FALSE: exactly one option isCorrect:true
- For MSQ: multiple options isCorrect:true

Respond with ONLY a valid JSON array — no markdown, no code fences, no explanation.`;

export async function extractQuestionsFromText(text: string): Promise<ExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new QuestionExtractionNotConfiguredError();

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${TEXT_EXTRACTION_PROMPT}\n\nContent to parse:\n\`\`\`\n${text.slice(0, 50000)}\n\`\`\`` },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new QuestionExtractionError(`AI provider responded with ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!rawText) throw new QuestionExtractionError("AI provider returned an empty response");

  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new QuestionExtractionError(`AI response did not contain a JSON array. Raw: ${rawText.slice(0, 300)}`);
  }

  let parsed: unknown[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new QuestionExtractionError("Failed to parse AI response as JSON array");
  }

  if (!Array.isArray(parsed)) throw new QuestionExtractionError("AI returned a non-array JSON value");

  const questions = parsed.map(normalizeQuestion).filter((q): q is ExtractedQuestion => q !== null);
  return { questions, rawResponse: rawText };
}

export async function extractQuestionsFromPDF(
  pdfBase64: string,
  fileSizeBytes: number
): Promise<ExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new QuestionExtractionNotConfiguredError();

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const maxTokens = Math.min(8192, Math.max(2048, Math.ceil(fileSizeBytes / 500)));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: pdfBase64,
              },
            },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new QuestionExtractionError(`AI provider responded with ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!rawText) throw new QuestionExtractionError("AI provider returned an empty response");

  // Extract JSON array from response
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new QuestionExtractionError(
      `AI response did not contain a JSON array. Raw: ${rawText.slice(0, 300)}`
    );
  }

  let parsed: unknown[];
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new QuestionExtractionError(`Failed to parse AI response as JSON array`);
  }

  if (!Array.isArray(parsed)) {
    throw new QuestionExtractionError("AI returned a non-array JSON value");
  }

  const questions = parsed
    .map(normalizeQuestion)
    .filter((q): q is ExtractedQuestion => q !== null);

  return { questions, rawResponse: rawText };
}
