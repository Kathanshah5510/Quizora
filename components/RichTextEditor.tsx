"use client";

import { useRef, useState } from "react";
import RichText from "./RichText";
import { wrapSelection, wrapBlock, toggleLinePrefix } from "@/lib/richtext/edit";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

type ToolAction =
  | { kind: "wrap"; before: string; after?: string; placeholder: string }
  | { kind: "block"; fence: string; placeholder: string }
  | { kind: "linePrefix"; prefix: string };

const TOOLS: { label: string; title: string; action: ToolAction }[] = [
  { label: "B", title: "Bold", action: { kind: "wrap", before: "**", placeholder: "bold text" } },
  { label: "I", title: "Italic", action: { kind: "wrap", before: "*", placeholder: "italic text" } },
  { label: "U", title: "Underline", action: { kind: "wrap", before: "<u>", after: "</u>", placeholder: "underlined text" } },
  { label: "</>", title: "Inline code", action: { kind: "wrap", before: "`", placeholder: "code" } },
  { label: "{ }", title: "Code block — preserves every line break", action: { kind: "block", fence: "```", placeholder: "code here" } },
  { label: "•", title: "Bullet list", action: { kind: "linePrefix", prefix: "- " } },
  { label: "1.", title: "Numbered list", action: { kind: "linePrefix", prefix: "1. " } },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Question text",
  rows = 3,
  disabled = false,
}: RichTextEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  function setSelectionLater(start: number, end: number) {
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start, end);
    });
  }

  function runTool(action: ToolAction) {
    if (disabled) return;
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end } = ta;

    const result =
      action.kind === "wrap"
        ? wrapSelection(value, start, end, action.before, action.after ?? action.before, action.placeholder)
        : action.kind === "block"
        ? wrapBlock(value, start, end, action.fence, action.placeholder)
        : toggleLinePrefix(value, start, end, action.prefix);

    onChange(result.next);
    setSelectionLater(result.selectionStart, result.selectionEnd);
  }

  return (
    <div className={`rounded-lg border border-border bg-background overflow-hidden ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            aria-label={t.title}
            disabled={disabled || showPreview}
            onClick={() => runTool(t.action)}
            className="min-w-[26px] h-6 px-1.5 rounded text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className={`rounded px-2 h-6 text-xs font-medium transition-colors ${
            showPreview ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>

      {showPreview ? (
        <div className="px-3 py-2.5 text-sm min-h-[4.5rem]" style={{ minHeight: `${rows * 1.6}rem` }}>
          {value.trim() ? (
            <RichText text={value} />
          ) : (
            <p className="text-muted-foreground">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className="w-full px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground bg-transparent focus:outline-none resize-y font-mono"
        />
      )}
    </div>
  );
}
