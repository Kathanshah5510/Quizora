"use client";

import { useState, useRef } from "react";
import type { ImportedQuestion, RowError } from "@/lib/utils/csvImport";

interface PreviewResult {
  preview: true;
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: RowError[];
  questions: ImportedQuestion[];
}

interface ImportResult {
  success: true;
  imported: number;
  skipped: number;
  errors: RowError[];
}

const TYPE_COLORS: Record<string, string> = {
  MCQ: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  MSQ: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  TRUE_FALSE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  SHORT_TEXT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  NUMERICAL: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  IMAGE_BASED: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

interface Props {
  examId: string;
}

type Step = "upload" | "preview" | "done";

export default function QuestionImport({ examId }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please select a CSV file.");
      return;
    }

    const fd = new FormData();
    fd.append("csv", file);

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/questions/import`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setLoading(false);
        return;
      }
      setPreview(data as PreviewResult);
      setStep("preview");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmImport() {
    if (!preview || preview.validCount === 0) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("File is no longer available. Please re-upload.");
      setStep("upload");
      return;
    }

    const fd = new FormData();
    fd.append("csv", file);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/questions/import?confirm=true`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        setLoading(false);
        return;
      }
      setImportResult(data as ImportResult);
      setStep("done");
    } catch {
      setError("Network error during import.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setPreview(null);
    setImportResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ─── Upload step ────────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-card-foreground">Upload CSV File</h3>

          <div className="rounded-lg bg-muted/40 border border-border p-4 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Expected columns (in order):</p>
            <code className="block text-xs font-mono overflow-x-auto whitespace-nowrap">
              type, text, marks, negative_marks, option_a, option_b, option_c, option_d, option_e, correct, numerical_answer, numerical_tolerance, text_answer, explanation
            </code>
            <ul className="space-y-1 list-disc pl-4">
              <li><strong>type</strong>: MCQ | MSQ | TRUE_FALSE | SHORT_TEXT | NUMERICAL | IMAGE_BASED</li>
              <li><strong>correct</strong>: Single letter for MCQ/T-F (A, B …), pipe-separated for MSQ (A|B)</li>
              <li><strong>numerical_answer</strong>: Required for NUMERICAL (tolerance optional)</li>
              <li><strong>text_answer</strong>: Required for SHORT_TEXT</li>
              <li>Header row is optional and auto-detected.</li>
            </ul>
            <a
              href={`data:text/csv;charset=utf-8,type%2Ctext%2Cmarks%2Cnegative_marks%2Coption_a%2Coption_b%2Coption_c%2Coption_d%2Coption_e%2Ccorrect%2Cnumerical_answer%2Cnumerical_tolerance%2Ctext_answer%2Cexplanation%0AMCQ%2C%22Example%20MCQ%22%2C2%2C0%2COption%20A%2COption%20B%2COption%20C%2COption%20D%2C%2CB%2C%2C%2C%2C%22Explanation%22%0ANUMERICAL%2C%22Example%20Numerical%22%2C2%2C0%2C%2C%2C%2C%2C%2C%2C42%2C0%2C%2C%22Explanation%22%0ASHORT_TEXT%2C%22Example%20Text%22%2C1%2C0%2C%2C%2C%2C%2C%2C%2C%2C%2CAccepted%20Answer%2C%22Explanation%22`}
              download="quizora_questions_template.csv"
              className="inline-block text-primary hover:underline"
            >
              ↓ Download CSV template
            </a>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                CSV file (max 2 MB)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20 transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Validating…" : "Validate & Preview"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Preview step ───────────────────────────────────────────────────────────
  if (step === "preview" && preview) {
    return (
      <div className="space-y-5">
        {/* Summary bar */}
        <div className={`rounded-xl border px-5 py-4 flex flex-wrap items-center gap-4 ${preview.errorCount > 0 ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20" : "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20"}`}>
          <div className="text-sm">
            <span className="font-semibold text-foreground">{preview.totalRows}</span>
            <span className="text-muted-foreground"> row{preview.totalRows !== 1 ? "s" : ""} detected</span>
          </div>
          <div className="text-sm text-green-700 dark:text-green-400 font-medium">
            ✓ {preview.validCount} valid
          </div>
          {preview.errorCount > 0 && (
            <div className="text-sm text-red-600 dark:text-red-400 font-medium">
              ✗ {preview.errorCount} error{preview.errorCount !== 1 ? "s" : ""}
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleReset}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              ← Re-upload
            </button>
            {preview.validCount > 0 && (
              <button
                onClick={handleConfirmImport}
                disabled={loading}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? "Importing…" : `Import ${preview.validCount} question${preview.validCount !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Row errors */}
        {preview.errors.length > 0 && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-card overflow-hidden">
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                Rows with errors (will be skipped)
              </p>
            </div>
            <div className="divide-y divide-border max-h-60 overflow-y-auto">
              {preview.errors.map((e, i) => (
                <div key={i} className="px-4 py-2.5 text-xs flex gap-3">
                  <span className="font-mono text-muted-foreground whitespace-nowrap">Row {e.row}</span>
                  <span className="font-medium text-foreground">{e.field}</span>
                  <span className="text-muted-foreground">{e.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Valid question previews */}
        {preview.questions.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-card-foreground">
                Valid questions ({preview.validCount})
              </p>
            </div>
            <div className="divide-y divide-border max-h-[28rem] overflow-y-auto">
              {preview.questions.map((q, i) => (
                <div key={i} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[q.type] ?? "bg-muted text-muted-foreground"}`}>
                      {q.type.replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? "s" : ""}{q.negativeMarks > 0 ? ` / -${q.negativeMarks}` : ""}</span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">{q.text}</p>
                  {q.options.length > 0 && (
                    <ul className="space-y-0.5 pl-2">
                      {q.options.map((o, oi) => (
                        <li key={oi} className={`text-xs ${o.isCorrect ? "text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>
                          {String.fromCharCode(65 + oi)}. {o.text}{o.isCorrect ? " ✓" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.numericalAnswer !== null && (
                    <p className="text-xs text-green-700 dark:text-green-400">Answer: {q.numericalAnswer}{q.numericalTolerance ? ` ± ${q.numericalTolerance}` : ""}</p>
                  )}
                  {q.textAnswer && (
                    <p className="text-xs text-green-700 dark:text-green-400">Answer: {q.textAnswer}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Done step ──────────────────────────────────────────────────────────────
  if (step === "done" && importResult) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-5 py-4">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            ✓ Import complete — {importResult.imported} question{importResult.imported !== 1 ? "s" : ""} added
          </p>
          {importResult.skipped > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {importResult.skipped} row{importResult.skipped !== 1 ? "s were" : " was"} skipped due to validation errors.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <a
            href={`/admin/exams/${examId}/questions`}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            View Questions →
          </a>
          <button
            onClick={handleReset}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Import More
          </button>
        </div>
      </div>
    );
  }

  return null;
}
