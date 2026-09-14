"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pending } from "@/components/Spinner";

interface QuestionRow {
  id: string;
  type: string;
  text: string;
  marks: number;
  optionCount: number;
}

interface SourceExam {
  id: string;
  title: string;
  courseCode: string;
  questions: QuestionRow[];
}

const TYPE_COLORS: Record<string, string> = {
  MCQ:        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  MSQ:        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  TRUE_FALSE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  SHORT_TEXT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  NUMERICAL:  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  IMAGE_BASED:"bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const TYPE_SHORT: Record<string, string> = {
  MCQ: "MCQ", MSQ: "MSQ", TRUE_FALSE: "T/F",
  SHORT_TEXT: "Text", NUMERICAL: "Num", IMAGE_BASED: "Img",
};

export default function CopyQuestionsClient({
  targetExamId,
  exams,
}: {
  targetExamId: string;
  exams: SourceExam[];
}) {
  const router = useRouter();
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null;

  function toggleQuestion(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!selectedExam) return;
    setSelectedIds(new Set(selectedExam.questions.map((q) => q.id)));
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  function handleExamChange(examId: string) {
    setSelectedExamId(examId);
    setSelectedIds(new Set());
  }

  function handleCopy() {
    if (!selectedExamId || selectedIds.size === 0) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/exams/${targetExamId}/questions/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceExamId: selectedExamId, questionIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to copy questions");
      } else {
        toast.success(`Copied ${data.copied} question${data.copied !== 1 ? "s" : ""}`);
        router.push(`/admin/exams/${targetExamId}/questions`);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Exam selector */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Source Exam</label>
        <select
          value={selectedExamId ?? ""}
          onChange={(e) => handleExamChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">— Select an exam —</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              [{e.courseCode}] {e.title} ({e.questions.length} questions)
            </option>
          ))}
        </select>
      </div>

      {/* Question list */}
      {selectedExam && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} of {selectedExam.questions.length} selected
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-primary hover:underline"
              >
                Select all
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border max-h-[420px] overflow-y-auto">
            {selectedExam.questions.map((q, idx) => {
              const checked = selectedIds.has(q.id);
              return (
                <label
                  key={q.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors select-none ${
                    checked ? "bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleQuestion(q.id)}
                    className="mt-0.5 shrink-0 accent-primary"
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Q{idx + 1}</span>
                      <span className={`text-xs rounded px-1.5 py-0.5 font-mono ${TYPE_COLORS[q.type] ?? "bg-muted text-muted-foreground"}`}>
                        {TYPE_SHORT[q.type] ?? q.type}
                      </span>
                      <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2 leading-snug">{q.text}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            disabled={selectedIds.size === 0 || isPending}
            className="btn-primary w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? <Pending>Copying…</Pending>
              : `Copy ${selectedIds.size > 0 ? selectedIds.size : ""} Question${selectedIds.size !== 1 ? "s" : ""} →`}
          </button>
        </div>
      )}
    </div>
  );
}
