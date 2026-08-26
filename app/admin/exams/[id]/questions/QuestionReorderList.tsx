"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { reorderQuestionsAction, duplicateQuestionAction } from "./actions";

interface QuestionRow {
  id: string;
  type: string;
  text: string;
  marks: number;
  negativeMarks: number;
  displayOrder: number;
  optionCount: number;
  correctCount: number;
  options?: { text: string; isCorrect: boolean }[];
  numericalAnswer?: number | null;
  numericalTolerance?: number | null;
  textAnswer?: string | null;
}

interface Props {
  examId: string;
  questions: QuestionRow[];
  typeLabels: Record<string, string>;
  typeColors: Record<string, string>;
  canEdit: boolean;
}

const ALL_TYPES = ["MCQ", "MSQ", "TRUE_FALSE", "SHORT_TEXT", "NUMERICAL", "IMAGE_BASED"] as const;

export default function QuestionReorderList({
  examId,
  questions: initial,
  typeLabels,
  typeColors,
  canEdit,
}: Props) {
  const [questions, setQuestions] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reorderMsg, setReorderMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const filteredIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    return new Set(
      questions
        .filter((item) => {
          const matchesSearch = !q || item.text.toLowerCase().includes(q);
          const matchesType = !typeFilter || item.type === typeFilter;
          return matchesSearch && matchesType;
        })
        .map((item) => item.id)
    );
  }, [questions, search, typeFilter]);

  // ─── Drag-to-reorder ──────────────────────────────────────────────────────

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) return;
    setQuestions((prev) => {
      const from = prev.findIndex((q) => q.id === draggingId);
      const to = prev.findIndex((q) => q.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((q, i) => ({ ...q, displayOrder: i + 1 }));
    });
  }

  function handleDrop() {
    setDraggingId(null);
    if (!canEdit) return;
    startTransition(async () => {
      const result = await reorderQuestionsAction(examId, {
        questions: questions.map((q) => ({ id: q.id, displayOrder: q.displayOrder })),
      });
      if (result && !result.success && result.error) {
        setReorderMsg("Failed to save order: " + result.error);
      } else {
        setReorderMsg(null);
      }
    });
  }

  // ─── Duplicate ─────────────────────────────────────────────────────────────

  async function handleDuplicate(questionId: string) {
    setDuplicatingId(questionId);
    const result = await duplicateQuestionAction(examId, questionId);
    setDuplicatingId(null);
    if (result && !result.success && result.error) {
      setReorderMsg("Failed to duplicate: " + result.error);
    }
    // Page will revalidate on success due to revalidatePath
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const visibleTypes = useMemo(
    () => [...new Set(questions.map((q) => q.type))],
    [questions]
  );

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions…"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setTypeFilter(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!typeFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            All
          </button>
          {visibleTypes.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              {typeLabels[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      {reorderMsg && <p className="text-xs text-red-500">{reorderMsg}</p>}
      {canEdit && (
        <p className="text-xs text-muted-foreground">
          Drag rows to reorder.{isPending && " Saving order…"}
        </p>
      )}

      {/* Question list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {questions.filter((q) => filteredIds.has(q.id)).length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No questions match your search.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {canEdit && <th className="w-8 px-3 py-3" />}
                <th className="w-10 px-3 py-3 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Question</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Marks</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {questions.map((q, idx) => {
                if (!filteredIds.has(q.id)) return null;
                const isExpanded = expandedId === q.id;
                return (
                  <tbody key={q.id}>
                    <tr
                      draggable={canEdit && !search && !typeFilter}
                      onDragStart={() => handleDragStart(q.id)}
                      onDragOver={(e) => handleDragOver(e, q.id)}
                      onDrop={handleDrop}
                      onDragEnd={() => setDraggingId(null)}
                      className={`border-t border-border transition-colors ${draggingId === q.id ? "opacity-40" : ""} ${canEdit && !search && !typeFilter ? "cursor-grab active:cursor-grabbing" : ""} hover:bg-muted/20`}
                    >
                      {canEdit && (
                        <td className="px-3 py-3 text-muted-foreground">
                          {!search && !typeFilter && (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 6a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm8-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" />
                            </svg>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <p className="text-foreground line-clamp-2 text-sm leading-snug">{q.text}</p>
                        {q.optionCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {q.optionCount} option{q.optionCount !== 1 ? "s" : ""} · {q.correctCount} correct
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[q.type] ?? "bg-muted text-muted-foreground"}`}>
                          {typeLabels[q.type] ?? q.type}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-muted-foreground text-xs whitespace-nowrap">
                        {q.marks}{q.negativeMarks > 0 ? ` / -${q.negativeMarks}` : ""}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : q.id)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                            title="Preview"
                          >
                            {isExpanded ? "▲ Hide" : "▼ Preview"}
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleDuplicate(q.id)}
                              disabled={duplicatingId === q.id}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                              title="Duplicate"
                            >
                              {duplicatingId === q.id ? "…" : "⊕"}
                            </button>
                          )}
                          <Link
                            href={`/admin/exams/${examId}/questions/${q.id}`}
                            className="text-xs text-primary hover:underline whitespace-nowrap"
                          >
                            {canEdit ? "Edit" : "View"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-border">
                        <td colSpan={canEdit ? 6 : 5} className="px-4 py-4 bg-muted/10">
                          <QuestionPreview question={q} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Inline question preview (admin sees correct answers) ──────────────────

function QuestionPreview({ question }: { question: QuestionRow }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{question.text}</p>

      {/* Options preview */}
      {question.options && question.options.length > 0 && (
        <ul className="space-y-1.5 pl-1">
          {question.options.map((opt, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 text-sm ${opt.isCorrect ? "text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}`}
            >
              <span
                className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  opt.isCorrect ? "border-green-500 bg-green-500" : "border-border"
                }`}
              >
                {opt.isCorrect && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {opt.text}
            </li>
          ))}
        </ul>
      )}

      {/* Numerical preview */}
      {question.numericalAnswer !== undefined && question.numericalAnswer !== null && (
        <div className="text-sm text-foreground">
          <span className="font-medium text-muted-foreground">Correct answer:</span>{" "}
          <span className="font-mono text-green-700 dark:text-green-400">{question.numericalAnswer}</span>
          {question.numericalTolerance != null && question.numericalTolerance !== 0 && (
            <span className="text-muted-foreground"> ± {question.numericalTolerance}</span>
          )}
        </div>
      )}

      {/* Text answer preview */}
      {question.textAnswer && (
        <div className="text-sm text-foreground">
          <span className="font-medium text-muted-foreground">Accepted answer:</span>{" "}
          <span className="font-mono text-green-700 dark:text-green-400">{question.textAnswer}</span>
        </div>
      )}

      {/* Marks badge */}
      <div className="flex gap-3 pt-1 text-xs text-muted-foreground border-t border-border">
        <span>Marks: <span className="text-foreground font-medium">{question.marks}</span></span>
        {question.negativeMarks > 0 && (
          <span>Negative: <span className="text-red-500 font-medium">-{question.negativeMarks}</span></span>
        )}
      </div>
    </div>
  );
}
