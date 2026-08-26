"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { reorderQuestionsAction } from "./actions";

interface QuestionRow {
  id: string;
  type: string;
  text: string;
  marks: number;
  negativeMarks: number;
  displayOrder: number;
  optionCount: number;
  correctCount: number;
}

interface Props {
  examId: string;
  questions: QuestionRow[];
  typeLabels: Record<string, string>;
  typeColors: Record<string, string>;
  canEdit: boolean;
}

export default function QuestionReorderList({ examId, questions: initial, typeLabels, typeColors, canEdit }: Props) {
  const [questions, setQuestions] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reorderMsg, setReorderMsg] = useState<string | null>(null);

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

  return (
    <div>
      {canEdit && (
        <p className="text-xs text-muted-foreground mb-3">
          Drag rows to reorder questions. Changes are saved automatically.
          {isPending && " Saving…"}
        </p>
      )}
      {reorderMsg && (
        <p className="text-xs text-red-500 mb-3">{reorderMsg}</p>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
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
          <tbody className="divide-y divide-border">
            {questions.map((q, idx) => (
              <tr
                key={q.id}
                draggable={canEdit}
                onDragStart={() => handleDragStart(q.id)}
                onDragOver={(e) => handleDragOver(e, q.id)}
                onDrop={handleDrop}
                onDragEnd={() => setDraggingId(null)}
                className={`transition-colors ${draggingId === q.id ? "opacity-40" : ""} ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} hover:bg-muted/30`}
              >
                {canEdit && (
                  <td className="px-3 py-3 text-muted-foreground">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 6a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm8-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                  </td>
                )}
                <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                <td className="px-3 py-3">
                  <p className="text-foreground line-clamp-2 text-sm">{q.text}</p>
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
                <td className="px-3 py-3 hidden md:table-cell text-muted-foreground text-xs">
                  {q.marks}{q.negativeMarks > 0 ? ` / -${q.negativeMarks}` : ""}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/exams/${examId}/questions/${q.id}`}
                    className="text-xs text-primary hover:underline whitespace-nowrap"
                  >
                    {canEdit ? "Edit" : "View"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
