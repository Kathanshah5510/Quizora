"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import MediaUploader from "./MediaUploader";

export type QuestionType = "MCQ" | "MSQ" | "TRUE_FALSE" | "SHORT_TEXT" | "NUMERICAL" | "IMAGE_BASED";

interface OptionState {
  text: string;
  isCorrect: boolean;
  displayOrder: number;
}

interface QuestionFormDefaults {
  type?: QuestionType;
  text?: string;
  marks?: number;
  negativeMarks?: number;
  options?: OptionState[];
  numericalAnswer?: number | null;
  numericalTolerance?: number | null;
  textAnswer?: string | null;
  explanation?: string | null;
  mediaAsset?: { id: string; url: string; filename?: string } | null;
}

interface QuestionFormProps {
  examId: string;
  defaultValues?: QuestionFormDefaults;
  isEdit?: boolean;
  onSubmit: (data: unknown) => Promise<{ error: string | null; success: boolean }>;
  submitLabel?: string;
}

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "MCQ", label: "Single Correct" },
  { value: "MSQ", label: "Multiple Correct" },
  { value: "TRUE_FALSE", label: "True / False" },
  { value: "NUMERICAL", label: "Numerical" },
  { value: "SHORT_TEXT", label: "Short Text" },
  { value: "IMAGE_BASED", label: "Image-Based" },
];

const OPTION_TYPES: QuestionType[] = ["MCQ", "MSQ", "TRUE_FALSE", "IMAGE_BASED"];

const DEFAULT_TRUE_FALSE: OptionState[] = [
  { text: "True", isCorrect: true, displayOrder: 0 },
  { text: "False", isCorrect: false, displayOrder: 1 },
];

function buildDefaultOptions(type: QuestionType, existing?: OptionState[]): OptionState[] {
  if (existing && existing.length > 0) return existing;
  if (type === "TRUE_FALSE") return DEFAULT_TRUE_FALSE;
  if (OPTION_TYPES.includes(type)) {
    return [
      { text: "", isCorrect: false, displayOrder: 0 },
      { text: "", isCorrect: false, displayOrder: 1 },
    ];
  }
  return [];
}

export default function QuestionForm({
  examId: _examId,
  defaultValues,
  isEdit = false,
  onSubmit,
  submitLabel,
}: QuestionFormProps) {
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<QuestionType>(defaultValues?.type ?? "MCQ");
  const [text, setText] = useState(defaultValues?.text ?? "");
  const [marks, setMarks] = useState(String(defaultValues?.marks ?? 1));
  const [negativeMarks, setNegativeMarks] = useState(String(defaultValues?.negativeMarks ?? 0));
  const [explanation, setExplanation] = useState(defaultValues?.explanation ?? "");
  const [showExplanation, setShowExplanation] = useState(!!defaultValues?.explanation);

  const [options, setOptions] = useState<OptionState[]>(() =>
    buildDefaultOptions(type, defaultValues?.options)
  );

  const [numericalAnswer, setNumericalAnswer] = useState(
    defaultValues?.numericalAnswer != null ? String(defaultValues.numericalAnswer) : ""
  );
  const [numericalTolerance, setNumericalTolerance] = useState(
    defaultValues?.numericalTolerance != null ? String(defaultValues.numericalTolerance) : ""
  );
  const [textAnswers, setTextAnswers] = useState<string[]>(() => {
    const raw = defaultValues?.textAnswer ?? "";
    const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [""];
  });
  const [newAnswer, setNewAnswer] = useState("");
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(defaultValues?.mediaAsset?.id ?? null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusIdx = useRef<number | null>(null);
  const savedOptionsRef = useRef<OptionState[] | null>(null);

  useEffect(() => {
    if (focusIdx.current !== null) {
      optionRefs.current[focusIdx.current]?.focus();
      focusIdx.current = null;
    }
  });

  function handleTypeChange(newType: QuestionType) {
    const prevType = type;
    setType(newType);
    setOptions((prev) => {
      const prevIsEditable = OPTION_TYPES.includes(prevType) && prevType !== "TRUE_FALSE";
      const newIsEditable = OPTION_TYPES.includes(newType) && newType !== "TRUE_FALSE";

      if (prevIsEditable && newIsEditable) {
        // MCQ ↔ MSQ ↔ IMAGE_BASED: preserve options.
        // For single-answer types, keep only the first correct selection.
        if (newType === "MCQ" || newType === "IMAGE_BASED") {
          const firstCorrect = prev.findIndex((o) => o.isCorrect);
          return prev.map((o, i) => ({ ...o, isCorrect: i === firstCorrect }));
        }
        return prev;
      }

      // Leaving editable-option type → snapshot the options so we can restore them.
      if (prevIsEditable) {
        savedOptionsRef.current = prev;
      }

      // Entering editable-option type → restore snapshot if one exists.
      if (newIsEditable && savedOptionsRef.current && savedOptionsRef.current.length > 0) {
        const restored = savedOptionsRef.current;
        if (newType === "MCQ" || newType === "IMAGE_BASED") {
          const firstCorrect = restored.findIndex((o) => o.isCorrect);
          return restored.map((o, i) => ({ ...o, isCorrect: i === firstCorrect }));
        }
        return restored;
      }

      return buildDefaultOptions(newType);
    });
    setServerError(null);
  }

  function addOption() {
    setOptions((prev) => {
      focusIdx.current = prev.length;
      return [...prev, { text: "", isCorrect: false, displayOrder: prev.length }];
    });
  }

  function removeOption(idx: number) {
    setOptions((prev) =>
      prev.filter((_, i) => i !== idx).map((o, i) => ({ ...o, displayOrder: i }))
    );
    setTimeout(() => optionRefs.current[Math.max(0, idx - 1)]?.focus(), 0);
  }

  function updateOptionText(idx: number, val: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text: val } : o)));
  }

  function toggleCorrect(idx: number) {
    setOptions((prev) => {
      if (type === "MCQ" || type === "TRUE_FALSE" || type === "IMAGE_BASED") {
        return prev.map((o, i) => ({ ...o, isCorrect: i === idx }));
      }
      return prev.map((o, i) => (i === idx ? { ...o, isCorrect: !o.isCorrect } : o));
    });
  }

  function handleOptionKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (idx === options.length - 1 && options.length < 10) {
        addOption();
      } else {
        optionRefs.current[idx + 1]?.focus();
      }
    } else if (e.key === "Backspace" && options[idx]?.text === "" && options.length > 2) {
      e.preventDefault();
      removeOption(idx);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMsg(null);

    const payload: Record<string, unknown> = {
      type,
      text: text.trim(),
      marks: parseFloat(marks) || 0,
      negativeMarks: parseFloat(negativeMarks) || 0,
      explanation: explanation.trim() || null,
      mediaAssetId: mediaAssetId ?? null,
    };

    if (OPTION_TYPES.includes(type)) {
      payload.options = options.map((o, i) => ({
        text: o.text.trim(),
        isCorrect: o.isCorrect,
        displayOrder: i,
      }));
    } else {
      payload.options = [];
    }

    if (type === "NUMERICAL") {
      payload.numericalAnswer = numericalAnswer !== "" ? parseFloat(numericalAnswer) : null;
      payload.numericalTolerance = numericalTolerance !== "" ? parseFloat(numericalTolerance) : null;
    }

    if (type === "SHORT_TEXT") {
      const joined = textAnswers.map((a) => a.trim()).filter(Boolean).join("|");
      payload.textAnswer = joined || null;
    }

    startTransition(async () => {
      const result = await onSubmit(payload);
      if (result && !result.success && result.error) {
        setServerError(result.error);
      } else if (result?.success) {
        setSuccessMsg("Question saved.");
      }
    });
  }

  const showOptions = OPTION_TYPES.includes(type);
  const isTrueFalse = type === "TRUE_FALSE";
  const isMSQ = type === "MSQ";
  const correctCount = options.filter((o) => o.isCorrect).length;
  const label = submitLabel ?? (isEdit ? "Save Question" : "Add Question");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Main card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">

        {/* Type selector — pill row */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map(({ value, label: tLabel }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTypeChange(value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                type === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tLabel}
            </button>
          ))}
        </div>

        {/* Question text */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Question text"
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />

        {/* Image uploader (IMAGE_BASED) */}
        {type === "IMAGE_BASED" && (
          <MediaUploader
            defaultAsset={defaultValues?.mediaAsset ?? null}
            onChange={(asset) => setMediaAssetId(asset?.id ?? null)}
          />
        )}

        {/* Options — full-row clickable */}
        {showOptions && (
          <div className="space-y-1.5">
            {options.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => toggleCorrect(idx)}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors group ${
                  opt.isCorrect
                    ? "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-900/20"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                {/* Radio / checkbox indicator */}
                <div
                  className={`w-4 h-4 shrink-0 border-2 flex items-center justify-center transition-colors ${
                    isMSQ ? "rounded" : "rounded-full"
                  } ${
                    opt.isCorrect
                      ? "border-green-500 bg-green-500"
                      : "border-muted-foreground/50 group-hover:border-primary/60"
                  }`}
                >
                  {opt.isCorrect && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <input
                  ref={(el) => { optionRefs.current[idx] = el; }}
                  value={opt.text}
                  onChange={(e) => updateOptionText(idx, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => handleOptionKeyDown(e, idx)}
                  placeholder={
                    isTrueFalse
                      ? idx === 0 ? "True" : "False"
                      : `Option ${String.fromCharCode(65 + idx)}`
                  }
                  readOnly={isTrueFalse}
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm text-foreground placeholder:text-muted-foreground min-w-0"
                />

                {!isTrueFalse && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeOption(idx); }}
                    disabled={options.length <= 2}
                    title="Remove option"
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:hidden transition-all"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {!isTrueFalse && options.length < 10 && (
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-2 pl-2 py-1 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-xs leading-none">+</span>
                Add option
                <span className="text-xs opacity-60 ml-1">or press Enter</span>
              </button>
            )}

            {correctCount === 0 && options.length >= 2 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 pl-1">
                Click an option row to mark the correct answer.
              </p>
            )}
          </div>
        )}

        {/* Numerical answer */}
        {type === "NUMERICAL" && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Correct answer *</label>
              <input
                type="number"
                step="any"
                value={numericalAnswer}
                onChange={(e) => setNumericalAnswer(e.target.value)}
                placeholder="e.g. 9.8"
                className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">± Tolerance</label>
              <input
                type="number"
                step="any"
                min="0"
                value={numericalTolerance}
                onChange={(e) => setNumericalTolerance(e.target.value)}
                placeholder="optional"
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <p className="text-xs text-muted-foreground self-end pb-2">
              Student answer must be within ± tolerance to be accepted.
            </p>
          </div>
        )}

        {/* Short text answer — multiple accepted answers */}
        {type === "SHORT_TEXT" && (
          <div className="space-y-2">
            <label className="block text-xs text-muted-foreground">
              Accepted answers * <span className="opacity-60">(case-insensitive · student matches any one)</span>
            </label>
            {/* Existing answer chips */}
            {textAnswers.filter(Boolean).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {textAnswers.map((ans, i) =>
                  ans.trim() ? (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full border border-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300"
                    >
                      {ans.trim()}
                      <button
                        type="button"
                        onClick={() => setTextAnswers((prev) => prev.filter((_, j) => j !== i))}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ) : null
                )}
              </div>
            )}
            {/* Add new answer */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = newAnswer.trim();
                    if (val && !textAnswers.map((a) => a.toLowerCase()).includes(val.toLowerCase())) {
                      setTextAnswers((prev) => [...prev, val]);
                    }
                    setNewAnswer("");
                  }
                }}
                placeholder="Type an accepted answer and press Enter"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => {
                  const val = newAnswer.trim();
                  if (val && !textAnswers.map((a) => a.toLowerCase()).includes(val.toLowerCase())) {
                    setTextAnswers((prev) => [...prev, val]);
                  }
                  setNewAnswer("");
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                + Add
              </button>
            </div>
          </div>
        )}

        {/* Marks + explanation toggle */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Marks</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-center text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">−ve marks</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={negativeMarks}
              onChange={(e) => setNegativeMarks(e.target.value)}
              className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-center text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowExplanation((v) => !v)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showExplanation ? "Hide explanation ↑" : "+ Add explanation"}
          </button>
        </div>

        {/* Explanation (collapsible) */}
        {showExplanation && (
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explanation shown to students after results are released..."
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        )}
      </div>

      {serverError && (
        <div className="rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {successMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isPending ? "Saving…" : label}
      </button>
    </form>
  );
}
