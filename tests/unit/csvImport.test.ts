import { describe, it, expect } from "vitest";
import { parseQuestionsCSV, generateCSVTemplate } from "@/lib/utils/csvImport";

const HEADER = "type,text,marks,negative_marks,option_a,option_b,option_c,option_d,option_e,correct,numerical_answer,numerical_tolerance,text_answer,explanation\n";

function csv(...rows: string[]) {
  return HEADER + rows.join("\n");
}

// ─── Basic parsing ─────────────────────────────────────────────────────────

describe("parseQuestionsCSV — empty/blank input", () => {
  it("returns empty result for empty string", () => {
    const r = parseQuestionsCSV("");
    expect(r.valid).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
    expect(r.totalRows).toBe(0);
  });

  it("returns empty result for whitespace-only string", () => {
    const r = parseQuestionsCSV("   \n  \n  ");
    expect(r.valid).toHaveLength(0);
  });

  it("skips header-only CSV", () => {
    const r = parseQuestionsCSV(HEADER.trim());
    expect(r.totalRows).toBe(0);
  });
});

// ─── MCQ ──────────────────────────────────────────────────────────────────

describe("parseQuestionsCSV — MCQ", () => {
  it("parses a valid MCQ row", () => {
    const r = parseQuestionsCSV(
      csv(`MCQ,"Which is supervised?",2,0.5,K-Means,Decision Tree,DBSCAN,PCA,,B,,,,`)
    );
    expect(r.valid).toHaveLength(1);
    expect(r.errors).toHaveLength(0);
    const q = r.valid[0];
    expect(q.type).toBe("MCQ");
    expect(q.text).toBe("Which is supervised?");
    expect(q.marks).toBe(2);
    expect(q.negativeMarks).toBe(0.5);
    expect(q.options).toHaveLength(4);
    expect(q.options[1].isCorrect).toBe(true); // B = index 1
    expect(q.options[0].isCorrect).toBe(false);
  });

  it("rejects MCQ with fewer than 2 options", () => {
    const r = parseQuestionsCSV(csv(`MCQ,"Question?",1,0,OnlyOption,,,,,,,,`));
    expect(r.errors.some((e) => e.field === "options")).toBe(true);
  });

  it("rejects MCQ with no correct letter", () => {
    const r = parseQuestionsCSV(csv(`MCQ,"Question?",1,0,A,B,C,,,,,,,`));
    expect(r.errors.some((e) => e.field === "correct")).toBe(true);
  });

  it("rejects MCQ with multiple correct letters", () => {
    const r = parseQuestionsCSV(csv(`MCQ,"Question?",1,0,A,B,C,,,"A|B",,,,`));
    expect(r.errors.some((e) => e.field === "correct")).toBe(true);
  });

  it("rejects MCQ with marks = 0", () => {
    const r = parseQuestionsCSV(csv(`MCQ,"Question?",0,0,A,B,,,,"A",,,,`));
    expect(r.errors.some((e) => e.field === "marks")).toBe(true);
  });

  it("rejects MCQ with correct letter pointing to non-existent option", () => {
    const r = parseQuestionsCSV(csv(`MCQ,"Question?",1,0,A,B,,,,"E",,,,`));
    expect(r.errors.some((e) => e.field === "correct" && e.message.includes("E"))).toBe(true);
  });

  it("handles lowercase type field", () => {
    const r = parseQuestionsCSV(csv(`mcq,"Question?",1,0,A,B,,,,"A",,,,`));
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].type).toBe("MCQ");
  });
});

// ─── MSQ ──────────────────────────────────────────────────────────────────

describe("parseQuestionsCSV — MSQ", () => {
  it("parses a valid MSQ row with pipe-separated correct", () => {
    const r = parseQuestionsCSV(
      csv(`MSQ,"Which are classification?",3,0,SVM,KNN,K-Means,LR,,"A|B|D",,,,`)
    );
    expect(r.valid).toHaveLength(1);
    const q = r.valid[0];
    expect(q.options.filter((o) => o.isCorrect)).toHaveLength(3);
    expect(q.options[0].isCorrect).toBe(true);
    expect(q.options[2].isCorrect).toBe(false);
  });

  it("rejects MSQ with no correct options", () => {
    const r = parseQuestionsCSV(csv(`MSQ,"Question?",2,0,A,B,C,,,,,,,`));
    expect(r.errors.some((e) => e.field === "correct")).toBe(true);
  });
});

// ─── TRUE_FALSE ───────────────────────────────────────────────────────────

describe("parseQuestionsCSV — TRUE_FALSE", () => {
  it("parses a valid True/False row", () => {
    const r = parseQuestionsCSV(
      csv(`TRUE_FALSE,"LR is supervised.",1,0.25,True,False,,,,B,,,,`)
    );
    expect(r.valid).toHaveLength(1);
    const q = r.valid[0];
    expect(q.type).toBe("TRUE_FALSE");
    expect(q.options).toHaveLength(2);
    expect(q.options[1].isCorrect).toBe(true); // B = False
  });

  it("rejects TRUE_FALSE with only 1 option", () => {
    const r = parseQuestionsCSV(csv(`TRUE_FALSE,"Question?",1,0,True,,,,,A,,,,`));
    expect(r.errors.some((e) => e.field === "options")).toBe(true);
  });

  it("rejects TRUE_FALSE with 3 options", () => {
    const r = parseQuestionsCSV(csv(`TRUE_FALSE,"Question?",1,0,True,False,Maybe,,,"A",,,,`));
    expect(r.errors.some((e) => e.field === "options")).toBe(true);
  });
});

// ─── NUMERICAL ────────────────────────────────────────────────────────────

describe("parseQuestionsCSV — NUMERICAL", () => {
  it("parses a valid numerical row", () => {
    const r = parseQuestionsCSV(
      csv(`NUMERICAL,"What is π to 2 dp?",2,0,,,,,,,3.14,0.005,,`)
    );
    expect(r.valid).toHaveLength(1);
    const q = r.valid[0];
    expect(q.numericalAnswer).toBe(3.14);
    expect(q.numericalTolerance).toBe(0.005);
  });

  it("defaults tolerance to 0 when omitted", () => {
    const r = parseQuestionsCSV(csv(`NUMERICAL,"What is 2+2?",1,0,,,,,,,4,,,`));
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].numericalTolerance).toBe(0);
  });

  it("rejects NUMERICAL with no answer", () => {
    const r = parseQuestionsCSV(csv(`NUMERICAL,"Question?",1,0,,,,,,,,,,`));
    expect(r.errors.some((e) => e.field === "numerical_answer")).toBe(true);
  });

  it("rejects NUMERICAL with negative tolerance", () => {
    const r = parseQuestionsCSV(csv(`NUMERICAL,"Question?",1,0,,,,,,,42,-0.5,,`));
    expect(r.errors.some((e) => e.field === "numerical_tolerance")).toBe(true);
  });
});

// ─── SHORT_TEXT ───────────────────────────────────────────────────────────

describe("parseQuestionsCSV — SHORT_TEXT", () => {
  it("parses a valid short text row", () => {
    const r = parseQuestionsCSV(
      csv(`SHORT_TEXT,"What does SVM stand for?",1,0,,,,,,,,,"Support Vector Machine",`)
    );
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].textAnswer).toBe("Support Vector Machine");
  });

  it("rejects SHORT_TEXT with no text_answer", () => {
    const r = parseQuestionsCSV(csv(`SHORT_TEXT,"Question?",1,0,,,,,,,,,,`));
    expect(r.errors.some((e) => e.field === "text_answer")).toBe(true);
  });
});

// ─── Mixed and malformed input ────────────────────────────────────────────

describe("parseQuestionsCSV — mixed/malformed", () => {
  it("imports valid rows and reports errors for invalid rows", () => {
    const r = parseQuestionsCSV(
      csv(
        `MCQ,"Valid MCQ",2,0,A,B,C,,,A,,,,`,
        `MCQ,"Missing options",1,0,,,,,,,,,`, // invalid
        `NUMERICAL,"Valid numerical",1,0,,,,,,,42,,`
      )
    );
    expect(r.valid).toHaveLength(2);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.totalRows).toBe(3);
  });

  it("rejects unknown question type", () => {
    const r = parseQuestionsCSV(csv(`ESSAY,"Question?",1,0,,,,,,,,,,`));
    expect(r.errors.some((e) => e.field === "type")).toBe(true);
  });

  it("rejects non-numeric marks", () => {
    const r = parseQuestionsCSV(csv(`MCQ,"Question?",abc,0,A,B,,,,"A",,,,`));
    expect(r.errors.some((e) => e.field === "marks")).toBe(true);
  });

  it("rejects missing question text", () => {
    const r = parseQuestionsCSV(csv(`MCQ,"",1,0,A,B,,,,"A",,,,`));
    expect(r.errors.some((e) => e.field === "text")).toBe(true);
  });

  it("handles CRLF line endings", () => {
    const data = `MCQ,"Question?",1,0,A,B,,,,"A",,,,\r\nNUMERICAL,"N?",1,0,,,,,,,5,,`;
    const r = parseQuestionsCSV(HEADER.replace("\n", "\r\n") + data);
    expect(r.valid).toHaveLength(2);
  });

  it("handles quoted fields with commas inside", () => {
    const r = parseQuestionsCSV(
      csv(`MCQ,"Option A, or B, or C?",1,0,"Choose A","Choose B",,,,"A",,,,`)
    );
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].text).toBe("Option A, or B, or C?");
    expect(r.valid[0].options[0].text).toBe("Choose A");
  });

  it("auto-detects CSV without header row", () => {
    const noHeader = `MCQ,"Question?",1,0,A,B,,,,"A",,,,\nNUMERICAL,"N?",1,0,,,,,,,7,,`;
    const r = parseQuestionsCSV(noHeader);
    expect(r.valid).toHaveLength(2);
  });

  it("ignores negative_marks value of 0", () => {
    const r = parseQuestionsCSV(csv(`MCQ,"Question?",1,0,A,B,,,,"A",,,,`));
    expect(r.valid).toHaveLength(1);
    expect(r.valid[0].negativeMarks).toBe(0);
  });
});

// ─── Template ─────────────────────────────────────────────────────────────

describe("generateCSVTemplate", () => {
  it("generates a non-empty template string", () => {
    const t = generateCSVTemplate();
    expect(t.length).toBeGreaterThan(100);
    expect(t).toContain("type,text");
    expect(t).toContain("MCQ");
    expect(t).toContain("NUMERICAL");
  });

  it("template parses successfully (all rows valid)", () => {
    const r = parseQuestionsCSV(generateCSVTemplate());
    expect(r.valid.length).toBeGreaterThan(0);
    expect(r.errors).toHaveLength(0);
  });
});
