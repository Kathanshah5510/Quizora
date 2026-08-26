"use client";

import { useActionState, useState } from "react";
import type { ExamActionState } from "@/app/admin/exams/actions";

type Course = { id: string; name: string; code: string };

type DefaultValues = {
  courseId?: string;
  title?: string;
  description?: string;
  instructorName?: string;
  taNames?: string[];
  slug?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  durationMinutes?: number;
  timerMode?: string;
  perQuestionSeconds?: number | null;
  attemptsAllowed?: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  allowBacktracking?: boolean;
  allowExternalStudents?: boolean;
  continueAfterAvailability?: boolean;
  fullScreenRequired?: boolean;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
  msqGradingPolicy?: string;
  numericalTolerance?: number | null;
  textGradingMode?: string;
  resultRelease?: string;
};

type Props = {
  action: (prev: ExamActionState, formData: FormData) => Promise<ExamActionState>;
  courses: Course[];
  defaultValues?: DefaultValues;
  isEdit?: boolean;
  submitLabel?: string;
};

const initialState: ExamActionState = { error: "", success: false };

function toDatetimeLocal(val: string | null | undefined): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExamForm({ action, courses, defaultValues, isEdit = false, submitLabel = "Save" }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [timerMode, setTimerMode] = useState(defaultValues?.timerMode ?? "WHOLE_QUIZ");

  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          Exam settings saved.
        </div>
      )}

      {/* ── Section 1: Basic Info ── */}
      <FormSection title="Basic Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="courseId" required>Course</Label>
            <select
              id="courseId"
              name="courseId"
              required
              defaultValue={defaultValues?.courseId ?? ""}
              disabled={pending}
              className={selectCls}
            >
              <option value="">Select a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instructorName" required>Instructor Name</Label>
            <input
              id="instructorName"
              name="instructorName"
              type="text"
              required
              placeholder="Prof. Arunava Chakravarty"
              defaultValue={defaultValues?.instructorName}
              disabled={pending}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="title" required>Exam Title</Label>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="e.g. IE403 — Quiz 1: Supervised Learning"
              defaultValue={defaultValues?.title}
              disabled={pending}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="description">Description / Instructions</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optional exam description or instructions shown to students"
              defaultValue={defaultValues?.description}
              disabled={pending}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="taNames">Teaching Assistants</Label>
            <input
              id="taNames"
              name="taNames"
              type="text"
              placeholder="Comma-separated TA names, e.g. John Doe, Jane Smith"
              defaultValue={defaultValues?.taNames?.join(", ")}
              disabled={pending}
              className={inputCls}
            />
          </div>

          {isEdit && (
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="slug">Public URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">/exam/</span>
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  defaultValue={defaultValues?.slug}
                  disabled={pending}
                  className={inputCls}
                />
              </div>
              <p className="text-xs text-muted-foreground">Changing this invalidates the current exam link.</p>
            </div>
          )}
        </div>
      </FormSection>

      {/* ── Section 2: Availability & Duration ── */}
      <FormSection title="Availability & Duration">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="availabilityStart">Availability Start</Label>
            <input
              id="availabilityStart"
              name="availabilityStart"
              type="datetime-local"
              defaultValue={toDatetimeLocal(defaultValues?.availabilityStart)}
              disabled={pending}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="availabilityEnd">Availability End</Label>
            <input
              id="availabilityEnd"
              name="availabilityEnd"
              type="datetime-local"
              defaultValue={toDatetimeLocal(defaultValues?.availabilityEnd)}
              disabled={pending}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="durationMinutes" required>Duration (minutes)</Label>
            <input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              required
              min={1}
              max={600}
              placeholder="60"
              defaultValue={defaultValues?.durationMinutes ?? 60}
              disabled={pending}
              className={inputCls}
            />
          </div>
        </div>
      </FormSection>

      {/* ── Section 3: Timer Mode ── */}
      <FormSection title="Timer Settings">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Timer Mode</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <RadioCard
                id="timer-whole"
                name="timerMode"
                value="WHOLE_QUIZ"
                checked={timerMode === "WHOLE_QUIZ"}
                onChange={() => setTimerMode("WHOLE_QUIZ")}
                label="Whole Quiz"
                description="Single countdown for the entire exam"
                disabled={pending}
              />
              <RadioCard
                id="timer-per"
                name="timerMode"
                value="PER_QUESTION"
                checked={timerMode === "PER_QUESTION"}
                onChange={() => setTimerMode("PER_QUESTION")}
                label="Per Question"
                description="Each question has its own time limit"
                disabled={pending}
              />
            </div>
          </div>

          {timerMode === "PER_QUESTION" && (
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="perQuestionSeconds" required>Seconds per question</Label>
              <input
                id="perQuestionSeconds"
                name="perQuestionSeconds"
                type="number"
                min={10}
                max={3600}
                placeholder="120"
                defaultValue={defaultValues?.perQuestionSeconds ?? ""}
                disabled={pending}
                className={inputCls}
              />
            </div>
          )}
        </div>
      </FormSection>

      {/* ── Section 4: Behavior & Anti-cheating ── */}
      <FormSection title="Behavior">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="attemptsAllowed" required>Attempts Allowed</Label>
            <input
              id="attemptsAllowed"
              name="attemptsAllowed"
              type="number"
              min={1}
              max={10}
              defaultValue={defaultValues?.attemptsAllowed ?? 1}
              disabled={pending}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2 space-y-3">
            <CheckboxField
              id="allowBacktracking"
              name="allowBacktracking"
              label="Allow backtracking"
              description="Students can go to previous questions and use question navigator"
              defaultChecked={defaultValues?.allowBacktracking ?? true}
              disabled={pending}
            />
            <CheckboxField
              id="randomizeQuestions"
              name="randomizeQuestions"
              label="Randomize question order"
              description="Each student sees questions in a different order"
              defaultChecked={defaultValues?.randomizeQuestions ?? false}
              disabled={pending}
            />
            <CheckboxField
              id="randomizeOptions"
              name="randomizeOptions"
              label="Randomize option order"
              description="MCQ/MSQ options are shuffled for each student"
              defaultChecked={defaultValues?.randomizeOptions ?? false}
              disabled={pending}
            />
            <CheckboxField
              id="fullScreenRequired"
              name="fullScreenRequired"
              label="Require full-screen"
              description="Warn students when they exit full-screen mode"
              defaultChecked={defaultValues?.fullScreenRequired ?? false}
              disabled={pending}
            />
            <CheckboxField
              id="allowExternalStudents"
              name="allowExternalStudents"
              label="Allow external students"
              description="Students not on the roster can attempt this exam (ID + email validation still required)"
              defaultChecked={defaultValues?.allowExternalStudents ?? false}
              disabled={pending}
            />
            <CheckboxField
              id="continueAfterAvailability"
              name="continueAfterAvailability"
              label="Allow continuation after availability window"
              description="Students who started before end time can continue beyond it"
              defaultChecked={defaultValues?.continueAfterAvailability ?? false}
              disabled={pending}
            />
          </div>
        </div>
      </FormSection>

      {/* ── Section 5: Scoring ── */}
      <FormSection title="Scoring">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="defaultMarks">Default marks per question</Label>
            <input
              id="defaultMarks"
              name="defaultMarks"
              type="number"
              min={0}
              step={0.5}
              defaultValue={defaultValues?.defaultMarks ?? 1}
              disabled={pending}
              className={inputCls}
            />
            <p className="text-xs text-muted-foreground">Can be overridden per question</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="defaultNegativeMarks">Default negative marks</Label>
            <input
              id="defaultNegativeMarks"
              name="defaultNegativeMarks"
              type="number"
              min={0}
              step={0.5}
              defaultValue={defaultValues?.defaultNegativeMarks ?? 0}
              disabled={pending}
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="msqGradingPolicy">MSQ grading policy</Label>
            <select
              id="msqGradingPolicy"
              name="msqGradingPolicy"
              defaultValue={defaultValues?.msqGradingPolicy ?? "STRICT"}
              disabled={pending}
              className={selectCls}
            >
              <option value="STRICT">Strict — all correct options selected, none wrong</option>
              <option value="PARTIAL">Partial — proportional marks</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="numericalTolerance">Numerical answer tolerance (±)</Label>
            <input
              id="numericalTolerance"
              name="numericalTolerance"
              type="number"
              min={0}
              step={0.001}
              placeholder="e.g. 0.001"
              defaultValue={defaultValues?.numericalTolerance ?? ""}
              disabled={pending}
              className={inputCls}
            />
            <p className="text-xs text-muted-foreground">Leave blank to require exact match</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="textGradingMode">Text answer grading</Label>
            <select
              id="textGradingMode"
              name="textGradingMode"
              defaultValue={defaultValues?.textGradingMode ?? "EXACT"}
              disabled={pending}
              className={selectCls}
            >
              <option value="EXACT">Exact match</option>
              <option value="MANUAL">Manual review</option>
              <option value="AI_ASSISTED">AI-assisted (admin review required)</option>
            </select>
          </div>
        </div>
      </FormSection>

      {/* ── Section 6: Results ── */}
      <FormSection title="Results">
        <div className="space-y-2">
          <Label>Result Release</Label>
          <div className="flex flex-col sm:flex-row gap-3">
            <RadioCard
              id="release-auto"
              name="resultRelease"
              value="AUTO"
              checked={(defaultValues?.resultRelease ?? "AUTO") === "AUTO"}
              onChange={() => {}}
              label="Automatic"
              description="Results released immediately after availability window ends"
              disabled={pending}
            />
            <RadioCard
              id="release-manual"
              name="resultRelease"
              value="MANUAL"
              checked={defaultValues?.resultRelease === "MANUAL"}
              onChange={() => {}}
              label="Manual"
              description="Admin releases results explicitly"
              disabled={pending}
            />
          </div>
        </div>
      </FormSection>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-3 bg-muted/40 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Label({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function CheckboxField({
  id, name, label, description, defaultChecked, disabled,
}: {
  id: string; name: string; label: string; description: string; defaultChecked?: boolean; disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer group">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer disabled:opacity-50"
      />
      <div>
        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{label}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}

function RadioCard({
  id, name, value, checked, onChange, label, description, disabled,
}: {
  id: string; name: string; value: string; checked: boolean; onChange: () => void;
  label: string; description: string; disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex-1 flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <input
        id={id}
        name={name}
        type="radio"
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 accent-primary"
      />
      <div>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";
const selectCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";
