"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ExtractedQuestion, ExtractedOption } from "@/lib/ai/extractQuestions";

interface Props {
  examId: string;
}

type Step = "upload" | "review" | "done";

export default function QuestionImport({ examId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState("");

  const handleExtract = useCallback(async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Please select a file."); return; }
    setError(null);
    setUploading(true);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/exams/${examId}/questions/import`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Extraction failed."); return; }
      if (!data.questions?.length) {
        setError("No questions could be extracted. Make sure the file contains exam questions.");
        return;
      }
      setQuestions(data.questions);
      setStep("review");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [examId]);

  const handleImport = useCallback(async () => {
    if (questions.length === 0) return;
    setError(null);
    setImporting(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}/questions/import?confirm=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Import failed."); return; }
      setImportedCount(data.imported);
      setStep("done");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  }, [examId, questions, router]);

  const updateQuestion = useCallback((idx: number, update: Partial<ExtractedQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...update } : q)));
  }, []);

  const toggleOptionCorrect = useCallback((qIdx: number, oIdx: number, type: ExtractedQuestion["type"]) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const updated: ExtractedOption[] = q.options.map((o, j) => {
          if (type === "MCQ" || type === "TRUE_FALSE") return { ...o, isCorrect: j === oIdx };
          return j === oIdx ? { ...o, isCorrect: !o.isCorrect } : o;
        });
        return { ...q, options: updated };
      })
    );
  }, []);

  const removeQuestion = useCallback((idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Done ───────────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 px-6 py-8 text-center space-y-3">
        <p className="text-lg font-semibold text-green-700 dark:text-green-400">
          {importedCount} question{importedCount !== 1 ? "s" : ""} imported
        </p>
        <p className="text-sm text-muted-foreground">Questions have been added to the exam.</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <a
            href={`/admin/exams/${examId}/questions`}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            View Questions →
          </a>
          <button
            onClick={() => { setStep("upload"); setQuestions([]); if (fileRef.current) fileRef.current.value = ""; }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Import Another
          </button>
        </div>
      </div>
    );
  }

  // ── Review ─────────────────────────────────────────────────────────────────────
  if (step === "review") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              {questions.length} question{questions.length !== 1 ? "s" : ""} extracted from <span className="font-mono text-xs">{fileName}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and edit before importing. Correct answers shown in green.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setStep("upload"); setQuestions([]); }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              ← Re-upload
            </button>
            <button
              onClick={handleImport}
              disabled={importing || questions.length === 0}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import ${questions.length} question${questions.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {questions.map((q, qIdx) => (
            <div key={qIdx} className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 text-xs font-mono text-muted-foreground shrink-0">Q{qIdx + 1}</span>
                <div className="flex-1 min-w-0 space-y-2">
                  <textarea
                    value={q.text}
                    onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(qIdx, { type: e.target.value as ExtractedQuestion["type"] })}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                    >
                      <option value="MCQ">MCQ</option>
                      <option value="MSQ">MSQ</option>
                      <option value="TRUE_FALSE">True/False</option>
                      <option value="SHORT_TEXT">Short Text</option>
                      <option value="NUMERICAL">Numerical</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      Marks:
                      <input
                        type="number" min={0} step={0.5} value={q.marks}
                        onChange={(e) => updateQuestion(qIdx, { marks: parseFloat(e.target.value) || 1 })}
                        className="w-14 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      −ve:
                      <input
                        type="number" min={0} step={0.25} value={q.negativeMarks}
                        onChange={(e) => updateQuestion(qIdx, { negativeMarks: parseFloat(e.target.value) || 0 })}
                        className="w-14 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none"
                      />
                    </label>
                    <button
                      onClick={() => removeQuestion(qIdx)}
                      className="ml-auto text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              {q.options.length > 0 && (
                <div className="space-y-1.5 pl-6">
                  <p className="text-xs text-muted-foreground">
                    {q.type === "MSQ" ? "Toggle correct answers:" : "Select correct answer:"}
                  </p>
                  {q.options.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => toggleOptionCorrect(qIdx, oIdx, q.type)}
                      className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                        opt.isCorrect
                          ? "border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="shrink-0 text-xs">{opt.isCorrect ? "✓" : q.type === "MSQ" ? "□" : "○"}</span>
                      <span className="flex-1">{opt.text}</span>
                    </button>
                  ))}
                </div>
              )}

              {q.type === "NUMERICAL" && (
                <div className="pl-6 flex items-center gap-3 text-xs text-muted-foreground">
                  <label className="flex items-center gap-1">
                    Answer:
                    <input
                      type="number" step="any" value={q.numericalAnswer ?? ""}
                      onChange={(e) => updateQuestion(qIdx, { numericalAnswer: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      className="w-24 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none"
                      placeholder="e.g. 9.8"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    ±Tolerance:
                    <input
                      type="number" step="any" min={0} value={q.numericalTolerance ?? ""}
                      onChange={(e) => updateQuestion(qIdx, { numericalTolerance: e.target.value === "" ? null : parseFloat(e.target.value) })}
                      className="w-20 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none"
                      placeholder="0.01"
                    />
                  </label>
                </div>
              )}

              {q.type === "SHORT_TEXT" && (
                <div className="pl-6">
                  <label className="text-xs text-muted-foreground flex flex-col gap-1">
                    Expected answer:
                    <input
                      type="text" value={q.textAnswer ?? ""}
                      onChange={(e) => updateQuestion(qIdx, { textAnswer: e.target.value || null })}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Expected answer text"
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        {questions.length > 3 && (
          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={importing || questions.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import ${questions.length} question${questions.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Upload ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 px-8 py-10 flex flex-col items-center gap-4 text-center">
        <div className="text-4xl">📊</div>
        <div>
          <p className="text-sm font-medium text-foreground">Upload your question file</p>
          <p className="text-xs text-muted-foreground mt-1">
            AI will intelligently extract questions from any format. Max 5 MB.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Accepts: CSV, TSV, Excel exports (.csv), or plain text
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
          className="hidden"
          id="csv-file-input"
        />
        <label
          htmlFor="csv-file-input"
          className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Choose file
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Tips for best results:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Include columns for question text, options (A/B/C/D), and the correct answer</li>
          <li>The AI handles any column naming — "Question", "Q", "Statement" all work</li>
          <li>Correct answer can be a letter (A), the answer text itself, or True/False</li>
          <li>Marks and negative marks columns are optional (defaults: 1 mark, 0 negative)</li>
          <li>Review extracted questions before importing</li>
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleExtract}
          disabled={uploading}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {uploading ? "Extracting questions…" : "Extract Questions with AI →"}
        </button>
      </div>
    </div>
  );
}
