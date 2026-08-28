import { describe, it, expect } from "vitest";

/** Mirrors the sanitizeCell function in the export route. */
function sanitizeCell(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  const sanitized = str.replace(/^[=+\-@\t\r]/, "'$&");
  return `"${sanitized.replace(/"/g, '""')}"`;
}

// ─── Formula injection prevention ────────────────────────────────────────────

describe("formula injection — leading character neutralisation", () => {
  const dangerousLeaders = ["=", "+", "-", "@", "\t", "\r"];

  for (const leader of dangerousLeaders) {
    it(`prefixes dangerous leader '${JSON.stringify(leader)}' with apostrophe`, () => {
      const result = sanitizeCell(`${leader}SUM(A1:A10)`);
      expect(result.startsWith(`"'${leader}`)).toBe(true);
    });
  }

  it("leaves safe strings unchanged (no prefix added)", () => {
    expect(sanitizeCell("Alice")).toBe('"Alice"');
  });

  it("numbers are not prefixed", () => {
    expect(sanitizeCell(42)).toBe('"42"');
  });

  it("negative numbers starting with '-' are prefixed", () => {
    const r = sanitizeCell("-5.0");
    expect(r).toBe('"\'-5.0"');
  });
});

// ─── Quoting and escaping ─────────────────────────────────────────────────────

describe("CSV cell quoting and escaping", () => {
  it("wraps all values in double quotes", () => {
    const r = sanitizeCell("hello");
    expect(r[0]).toBe('"');
    expect(r[r.length - 1]).toBe('"');
  });

  it("escapes internal double quotes by doubling them", () => {
    const r = sanitizeCell(`say "hello"`);
    expect(r).toBe('"say ""hello"""');
  });

  it("handles empty string", () => {
    expect(sanitizeCell("")).toBe('""');
  });

  it("handles null as empty cell", () => {
    expect(sanitizeCell(null)).toBe('""');
  });

  it("handles undefined as empty cell", () => {
    expect(sanitizeCell(undefined)).toBe('""');
  });

  it("preserves commas inside a cell (they are quoted, not split)", () => {
    const r = sanitizeCell("Smith, John");
    expect(r).toBe('"Smith, John"');
  });

  it("preserves newlines inside a cell", () => {
    const r = sanitizeCell("line1\nline2");
    expect(r).toBe('"line1\nline2"');
  });
});

// ─── Row generation ───────────────────────────────────────────────────────────

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(sanitizeCell).join(",");
}

describe("CSV row construction", () => {
  it("joins cells with commas", () => {
    const r = row(["A", "B", "C"]);
    expect(r).toBe('"A","B","C"');
  });

  it("numeric score cells are formatted as strings", () => {
    const r = row(["Student", 8.5, 10]);
    expect(r).toBe('"Student","8.5","10"');
  });

  it("null cells produce empty quoted cells", () => {
    const r = row(["Alice", null, ""]);
    expect(r).toBe('"Alice","",""');
  });

  it("percentage cell value is preserved as-is", () => {
    const r = row(["Alice", "85.00%"]);
    expect(r).toBe('"Alice","85.00%"');
  });
});
