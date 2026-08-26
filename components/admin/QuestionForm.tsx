"use client";

import { useState, useTransition } from "react";

type QuestionType = "MCQ" | "MSQ" | "TRUE_FALSE" | "SHORT_TEXT" | "NUMERICAL" | "IMAGE_BASED";

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
  mediaAssetId?: string | null;
}

interface QuestionFormProps {
  examId: string;
  defaultValues?: QuestionFormDefaults;
  isEdit?: boolean;
  onSubmit: (data: unknown) => Promise<{ error: string | null; success: boolean }>;
  submitLabel?: string;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: "Single Correct (MCQ)",
  MSQ: "Multiple Correct (MSQ)",
  TRUE_FALSE: "True / False",
  SHORT_TEXT: "Short Text",
  NUMERICAL: "Numerical",
  IMAGE_BASED: "Image-Based",
};

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground mb-1.5">
      {children}
    </label>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{msg}</p>;
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Input({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  step,
  min,
  className = "",
}: {
  id?: string;
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  className?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      step={step}
      min={min}
      className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
    />
  );
}

function Textarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
    />
  );
}

// ─── Main QuestionForm ────────────────────────────────────────────────────────

export default function QuestionForm({
  examId,
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

  const [options, setOptions] = useState<OptionState[]>(() =>
    buildDefaultOptions(type, defaultValues?.options)
  );

  const [numericalAnswer, setNumericalAnswer] = useState(
    defaultValues?.numericalAnswer != null ? String(defaultValues.numericalAnswer) : ""
  );
  const [numericalTolerance, setNumericalTolerance] = useState(
    defaultValues?.numericalTolerance != null ? String(defaultValues.numericalTolerance) : ""
  );

  const [textAnswer, setTextAnswer] = useState(defaultValues?.textAnswer ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleTypeChange(newType: QuestionType) {
    setType(newType);
    setOptions(buildDefaultOptions(newType));
    setServerError(null);
  }

  // ─── Options management ───────────────────────────────────────────────────

  function addOption() {
    setOptions((prev) => [
      ...prev,
      { text: "", isCorrect: false, displayOrder: prev.length },
    ]);
  }

  function removeOption(idx: number) {
    setOptions((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((o, i) => ({ ...o, displayOrder: i }))
    );
  }

  function updateOptionText(idx: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, text } : o)));
  }

  function toggleCorrect(idx: number) {
    setOptions((prev) => {
      if (type === "MCQ" || type === "TRUE_FALSE" || type === "IMAGE_BASED") {
        // Single-correct: clear all then set this one
        return prev.map((o, i) => ({ ...o, isCorrect: i === idx }));
      }
      // MSQ: toggle
      return prev.map((o, i) => (i === idx ? { ...o, isCorrect: !o.isCorrect } : o));
    });
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

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
      payload.numericalTolerance =
        numericalTolerance !== "" ? parseFloat(numericalTolerance) : null;
    }

    if (type === "SHORT_TEXT") {
      payload.textAnswer = textAnswer.trim() || null;
    }

    startTransition(async () => {
      const result = await onSubmit(payload);
      if (result && !result.success && result.error) {
        setServerError(result.error);
      } else if (result?.success && !isEdit) {
        // redirect happens server-side on create; for edit show success
      } else if (result?.success) {
        setSuccessMsg("Question saved.");
      }
    });
  }

  const showOptions = OPTION_TYPES.includes(type);
  const isTrueFalse = type === "TRUE_FALSE";
  const correctCount = options.filter((o) => o.isCorrect).length;

  const label = submitLabel ?? (isEdit ? "Save Question" : "Add Question");

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Question type */}
      <FormSection title="Question Type">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                type === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </FormSection>

      {/* Question text */}
      <FormSection title="Question">
        <div>
          <Label htmlFor="qtext">Question text *</Label>
          <Textarea
            id="qtext"
            value={text}
            onChange={setText}
            placeholder="Enter the question..."
            rows={4}
          />
        </div>
      </FormSection>

      {/* Options (MCQ / MSQ / T-F / IMAGE_BASED) */}
      {showOptions && (
        <FormSection title="Answer Options">
          {type === "MCQ" || type === "IMAGE_BASED" ? (
            <p className="text-xs text-muted-foreground -mt-1">Click the circle to mark the correct answer.</p>
          ) : type === "MSQ" ? (
            <p className="text-xs text-muted-foreground -mt-1">Click checkboxes to mark all correct answers.</p>
          ) : null}

          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {/* Correct indicator */}
                <button
                  type="button"
                  onClick={() => toggleCorrect(idx)}
                  title={opt.isCorrect ? "Correct answer" : "Mark as correct"}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 transition-colors ${
                    opt.isCorrect
                      ? "border-green-500 bg-green-500"
                      : "border-border hover:border-green-400"
                  }`}
                  aria-pressed={opt.isCorrect}
                >
                  {opt.isCorrect && (
                    <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <Input
                  value={opt.text}
                  onChange={(v) => updateOptionText(idx, v)}
                  placeholder={
                    isTrueFalse
                      ? idx === 0
                        ? "True"
                        : "False"
                      : `Option ${String.fromCharCode(65 + idx)}`
                  }
                  className="flex-1"
                />

                {!isTrueFalse && options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Remove option"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {!isTrueFalse && options.length < 10 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-1 text-sm text-primary hover:underline"
            >
              + Add option
            </button>
          )}

          {correctCount === 0 && options.length >= 2 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No correct answer selected. Mark at least one option as correct.
            </p>
          )}
        </FormSection>
      )}

      {/* Numerical fields */}
      {type === "NUMERICAL" && (
        <FormSection title="Numerical Answer">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="num-answer">Correct answer *</Label>
              <Input
                id="num-answer"
                type="number"
                step="any"
                value={numericalAnswer}
                onChange={setNumericalAnswer}
                placeholder="e.g. 3.14"
              />
            </div>
            <div>
              <Label htmlFor="num-tol">Tolerance (±)</Label>
              <Input
                id="num-tol"
                type="number"
                step="any"
                min="0"
                value={numericalTolerance}
                onChange={setNumericalTolerance}
                placeholder="e.g. 0.01  (optional)"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Student answers within ± tolerance of the correct value are accepted.
          </p>
        </FormSection>
      )}

      {/* Short text answer */}
      {type === "SHORT_TEXT" && (
        <FormSection title="Accepted Answer">
          <Label htmlFor="text-answer">Correct answer *</Label>
          <Input
            id="text-answer"
            value={textAnswer}
            onChange={setTextAnswer}
            placeholder="e.g. Support Vector Machine"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Exact-match mode: student answer must match this text (case-insensitive).
            Manual grading is available post-exam.
          </p>
        </FormSection>
      )}

      {/* Image-based note */}
      {type === "IMAGE_BASED" && (
        <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Image/media attachment is available after saving the question. Set the question text and options now.
        </div>
      )}

      {/* Marks */}
      <FormSection title="Marks">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="marks">Marks *</Label>
            <Input
              id="marks"
              type="number"
              step="0.5"
              min="0.5"
              value={marks}
              onChange={setMarks}
              placeholder="1"
            />
          </div>
          <div>
            <Label htmlFor="neg-marks">Negative marks</Label>
            <Input
              id="neg-marks"
              type="number"
              step="0.5"
              min="0"
              value={negativeMarks}
              onChange={setNegativeMarks}
              placeholder="0"
            />
          </div>
        </div>
      </FormSection>

      {/* Explanation (optional) */}
      <FormSection title="Explanation (optional)">
        <Textarea
          id="explanation"
          value={explanation}
          onChange={setExplanation}
          placeholder="Shown to students after result release..."
          rows={3}
        />
      </FormSection>

      {/* Feedback */}
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

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? "Saving…" : label}
        </button>
      </div>
    </form>
  );
}
