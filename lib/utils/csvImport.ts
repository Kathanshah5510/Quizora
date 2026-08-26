/**
 * Bulk question CSV import — pure functions, no DB access.
 *
 * Expected columns (header row optional):
 * type, text, marks, negative_marks, option_a, option_b, option_c, option_d, option_e,
 * correct, numerical_answer, numerical_tolerance, text_answer, explanation
 *
 * `correct` field:
 *   - MCQ / TRUE_FALSE / IMAGE_BASED: single letter (A–E)
 *   - MSQ: pipe-separated letters (A|B|D)
 *   - NUMERICAL / SHORT_TEXT: leave blank
 */

export interface ImportedQuestion {
  type: "MCQ" | "MSQ" | "TRUE_FALSE" | "SHORT_TEXT" | "NUMERICAL" | "IMAGE_BASED";
  text: string;
  marks: number;
  negativeMarks: number;
  options: { text: string; isCorrect: boolean; displayOrder: number }[];
  numericalAnswer: number | null;
  numericalTolerance: number | null;
  textAnswer: string | null;
  explanation: string | null;
}

export interface RowError {
  row: number; // 1-based (excluding header if present)
  field: string;
  message: string;
}

export interface CSVImportResult {
  valid: ImportedQuestion[];
  errors: RowError[];
  totalRows: number;
}

const VALID_TYPES = ["MCQ", "MSQ", "TRUE_FALSE", "SHORT_TEXT", "NUMERICAL", "IMAGE_BASED"] as const;
type QuestionType = (typeof VALID_TYPES)[number];

const HEADER_KEYWORDS = ["type", "text", "marks"];

/** Split a CSV line respecting quoted fields. Handles CRLF and embedded commas in quotes. */
function splitCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Strip surrounding quotes and trim whitespace from a cell value. */
function cell(raw: string | undefined): string {
  if (raw === undefined) return "";
  return raw.replace(/^["']|["']$/g, "").trim();
}

function parseNumber(raw: string, fieldName: string, row: number, errors: RowError[]): number | null {
  const v = cell(raw);
  if (!v) return null;
  const n = parseFloat(v);
  if (isNaN(n)) {
    errors.push({ row, field: fieldName, message: `"${v}" is not a valid number` });
    return null;
  }
  return n;
}

function letterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, ...
}

export function parseQuestionsCSV(text: string): CSVImportResult {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return { valid: [], errors: [], totalRows: 0 };

  // Auto-detect header
  const firstCells = splitCSVLine(nonEmpty[0]).map((c) => cell(c).toLowerCase());
  const hasHeader = HEADER_KEYWORDS.every((kw) => firstCells.includes(kw));
  const dataLines = hasHeader ? nonEmpty.slice(1) : nonEmpty;

  const valid: ImportedQuestion[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 1; // 1-based
    const cols = splitCSVLine(dataLines[i]);

    const rawType = cell(cols[0]).toUpperCase();
    const rawText = cell(cols[1]);
    const rawMarks = cell(cols[2]);
    const rawNegMarks = cell(cols[3]);
    const rawOpts = [cell(cols[4]), cell(cols[5]), cell(cols[6]), cell(cols[7]), cell(cols[8])];
    const rawCorrect = cell(cols[9]).toUpperCase();
    const rawNumericalAnswer = cell(cols[10]);
    const rawNumericalTolerance = cell(cols[11]);
    const rawTextAnswer = cell(cols[12]);
    const rawExplanation = cell(cols[13]);

    const rowErrors: RowError[] = [];

    // ── type ──────────────────────────────────────────────────────────────────
    if (!VALID_TYPES.includes(rawType as QuestionType)) {
      rowErrors.push({
        row: rowNum,
        field: "type",
        message: `Unknown type "${rawType}". Must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }
    const type = rawType as QuestionType;

    // ── text ──────────────────────────────────────────────────────────────────
    if (!rawText) {
      rowErrors.push({ row: rowNum, field: "text", message: "Question text is required" });
    } else if (rawText.length > 5000) {
      rowErrors.push({ row: rowNum, field: "text", message: "Question text exceeds 5000 characters" });
    }

    // ── marks ─────────────────────────────────────────────────────────────────
    const marks = parseNumber(rawMarks, "marks", rowNum, rowErrors);
    if (marks !== null && marks <= 0) {
      rowErrors.push({ row: rowNum, field: "marks", message: "Marks must be greater than 0" });
    }
    if (marks !== null && marks > 100) {
      rowErrors.push({ row: rowNum, field: "marks", message: "Marks cannot exceed 100" });
    }

    // ── negative marks ────────────────────────────────────────────────────────
    const negativeMarks = rawNegMarks ? parseNumber(rawNegMarks, "negative_marks", rowNum, rowErrors) : 0;
    if (negativeMarks !== null && negativeMarks < 0) {
      rowErrors.push({ row: rowNum, field: "negative_marks", message: "Negative marks cannot be a negative number" });
    }

    // ── type-specific validation ──────────────────────────────────────────────
    const optionTypes: QuestionType[] = ["MCQ", "MSQ", "TRUE_FALSE", "IMAGE_BASED"];
    let options: ImportedQuestion["options"] = [];
    let numericalAnswer: number | null = null;
    let numericalTolerance: number | null = null;
    let textAnswer: string | null = null;

    if (optionTypes.includes(type)) {
      const filledOpts = rawOpts.filter((o) => o.length > 0);
      if (filledOpts.length < 2) {
        rowErrors.push({ row: rowNum, field: "options", message: `${type} requires at least 2 options (option_a, option_b, …)` });
      }
      if (filledOpts.length > 10) {
        rowErrors.push({ row: rowNum, field: "options", message: "Cannot have more than 10 options" });
      }
      if (type === "TRUE_FALSE" && filledOpts.length !== 2) {
        rowErrors.push({ row: rowNum, field: "options", message: "TRUE_FALSE must have exactly 2 options" });
      }

      // Parse correct letters
      const correctLetters = rawCorrect
        ? rawCorrect.split("|").map((l) => l.trim()).filter((l) => /^[A-E]$/.test(l))
        : [];

      if (correctLetters.length === 0) {
        rowErrors.push({ row: rowNum, field: "correct", message: `correct field is required for ${type} (e.g. "A" or "A|B")` });
      }

      if ((type === "MCQ" || type === "TRUE_FALSE" || type === "IMAGE_BASED") && correctLetters.length > 1) {
        rowErrors.push({ row: rowNum, field: "correct", message: `${type} must have exactly one correct answer` });
      }
      if (type === "MSQ" && correctLetters.length < 1) {
        rowErrors.push({ row: rowNum, field: "correct", message: "MSQ must have at least one correct answer" });
      }

      // Validate letters refer to existing options
      for (const letter of correctLetters) {
        const idx = letterToIndex(letter);
        if (idx >= filledOpts.length) {
          rowErrors.push({ row: rowNum, field: "correct", message: `Correct answer "${letter}" refers to a non-existent option` });
        }
      }

      const correctIdxs = new Set(correctLetters.map(letterToIndex));
      options = filledOpts.map((text, i) => ({
        text,
        isCorrect: correctIdxs.has(i),
        displayOrder: i,
      }));
    }

    if (type === "NUMERICAL") {
      numericalAnswer = parseNumber(rawNumericalAnswer, "numerical_answer", rowNum, rowErrors);
      if (numericalAnswer === null && rowErrors.every((e) => e.field !== "numerical_answer")) {
        rowErrors.push({ row: rowNum, field: "numerical_answer", message: "numerical_answer is required for NUMERICAL type" });
      }
      numericalTolerance = rawNumericalTolerance
        ? parseNumber(rawNumericalTolerance, "numerical_tolerance", rowNum, rowErrors)
        : 0;
      if (numericalTolerance !== null && numericalTolerance < 0) {
        rowErrors.push({ row: rowNum, field: "numerical_tolerance", message: "numerical_tolerance cannot be negative" });
      }
    }

    if (type === "SHORT_TEXT") {
      textAnswer = rawTextAnswer || null;
      if (!textAnswer) {
        rowErrors.push({ row: rowNum, field: "text_answer", message: "text_answer is required for SHORT_TEXT type" });
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      valid.push({
        type,
        text: rawText,
        marks: marks!,
        negativeMarks: negativeMarks ?? 0,
        options,
        numericalAnswer,
        numericalTolerance,
        textAnswer,
        explanation: rawExplanation || null,
      });
    }
  }

  return { valid, errors, totalRows: dataLines.length };
}

/** Generate a downloadable CSV template string. */
export function generateCSVTemplate(): string {
  const header = "type,text,marks,negative_marks,option_a,option_b,option_c,option_d,option_e,correct,numerical_answer,numerical_tolerance,text_answer,explanation\r\n";
  const rows = [
    `MCQ,"Which of the following is a supervised learning algorithm?",2,0.5,K-Means,Decision Tree,DBSCAN,PCA,,B,,,,"Decision Tree and other regression/classification algorithms are supervised"`,
    `MSQ,"Which of the following are classification algorithms?",3,0,SVM,KNN,K-Means,Logistic Regression,,A|B|D,,,,"SVM, KNN, and Logistic Regression are used for classification"`,
    `TRUE_FALSE,"Linear regression can be used for classification tasks.",1,0.25,True,False,,,,B,,,,"Logistic regression, not linear regression, is used for classification"`,
    `NUMERICAL,"If a model explains 85% of variance what is its R² score?",2,0,,,,,,,85,0,,"R² = 0.85 means 85% of variance is explained"`,
    `SHORT_TEXT,"What does SVM stand for?",1,0,,,,,,,,,"Support Vector Machine","SVM = Support Vector Machine"`,
  ];
  return header + rows.join("\r\n") + "\r\n";
}
