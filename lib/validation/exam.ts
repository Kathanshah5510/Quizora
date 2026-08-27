import { z } from "zod";

export const CreateExamSchema = z
  .object({
    courseId: z.string().min(1, "Course is required"),
    title: z.string().min(2, "Title must be at least 2 characters").max(200, "Title too long"),
    description: z.string().max(2000, "Description too long").optional().nullable(),
    instructorName: z.string().min(2, "Instructor name is required").max(100),
    taNames: z.array(z.string().min(1).max(100)).optional().default([]),
    availabilityStart: z.string().optional().nullable(),
    availabilityEnd: z.string().optional().nullable(),
    durationMinutes: z
      .number()
      .int("Duration must be a whole number")
      .min(1, "Duration must be at least 1 minute")
      .max(600, "Duration cannot exceed 10 hours"),
    timerMode: z.enum(["WHOLE_QUIZ", "PER_QUESTION"]).default("WHOLE_QUIZ"),
    perQuestionSeconds: z.number().int().min(10).max(3600).optional().nullable(),
    attemptsAllowed: z
      .number()
      .int("Must be a whole number")
      .min(1, "Must allow at least 1 attempt")
      .max(10, "Cannot exceed 10 attempts")
      .default(1),
    randomizeQuestions: z.boolean().default(false),
    randomizeOptions: z.boolean().default(false),
    allowBacktracking: z.boolean().default(true),
    allowExternalStudents: z.boolean().default(false),
    continueAfterAvailability: z.boolean().default(false),
    fullScreenRequired: z.boolean().default(false),
    reconnectGraceSeconds: z
      .number()
      .int("Must be a whole number")
      .min(10, "Must be at least 10 seconds")
      .max(120, "Cannot exceed 120 seconds")
      .default(30),
    maxTabViolations: z
      .number()
      .int("Must be a whole number")
      .min(1, "Must allow at least 1 violation")
      .max(10, "Cannot exceed 10 violations")
      .default(2),
    defaultMarks: z.number().min(0, "Cannot be negative").max(100, "Too high").default(1),
    defaultNegativeMarks: z.number().min(0, "Cannot be negative").max(100, "Too high").default(0),
    msqGradingPolicy: z.enum(["STRICT", "PARTIAL"]).default("STRICT"),
    numericalTolerance: z.number().min(0, "Cannot be negative").optional().nullable(),
    textGradingMode: z.enum(["EXACT", "MANUAL", "AI_ASSISTED"]).default("EXACT"),
    resultRelease: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  })
  .refine(
    (data) => {
      if (data.timerMode === "PER_QUESTION" && !data.perQuestionSeconds) return false;
      return true;
    },
    { message: "Per-question duration is required for PER_QUESTION timer mode", path: ["perQuestionSeconds"] }
  )
  .refine(
    (data) => {
      if (data.availabilityStart && data.availabilityEnd) {
        return new Date(data.availabilityStart) < new Date(data.availabilityEnd);
      }
      return true;
    },
    { message: "Availability end must be after start", path: ["availabilityEnd"] }
  );

export const UpdateExamSchema = z
  .object({
    courseId: z.string().min(1).optional(),
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    instructorName: z.string().min(2).max(100).optional(),
    taNames: z.array(z.string()).optional(),
    slug: z.string().min(2).max(100).optional(),
    availabilityStart: z.string().optional().nullable(),
    availabilityEnd: z.string().optional().nullable(),
    durationMinutes: z.number().int().min(1).max(600).optional(),
    timerMode: z.enum(["WHOLE_QUIZ", "PER_QUESTION"]).optional(),
    perQuestionSeconds: z.number().int().min(10).max(3600).optional().nullable(),
    attemptsAllowed: z.number().int().min(1).max(10).optional(),
    randomizeQuestions: z.boolean().optional(),
    randomizeOptions: z.boolean().optional(),
    allowBacktracking: z.boolean().optional(),
    allowExternalStudents: z.boolean().optional(),
    continueAfterAvailability: z.boolean().optional(),
    fullScreenRequired: z.boolean().optional(),
    reconnectGraceSeconds: z.number().int().min(10).max(120).optional(),
    maxTabViolations: z.number().int().min(1).max(10).optional(),
    defaultMarks: z.number().min(0).max(100).optional(),
    defaultNegativeMarks: z.number().min(0).max(100).optional(),
    msqGradingPolicy: z.enum(["STRICT", "PARTIAL"]).optional(),
    numericalTolerance: z.number().min(0).optional().nullable(),
    textGradingMode: z.enum(["EXACT", "MANUAL", "AI_ASSISTED"]).optional(),
    resultRelease: z.enum(["AUTO", "MANUAL"]).optional(),
  })
  .refine(
    (data) => {
      if (data.availabilityStart && data.availabilityEnd) {
        return new Date(data.availabilityStart) < new Date(data.availabilityEnd);
      }
      return true;
    },
    { message: "Availability end must be after start", path: ["availabilityEnd"] }
  );

export type CreateExamInput = z.output<typeof CreateExamSchema>;
export type UpdateExamInput = z.output<typeof UpdateExamSchema>;

export function parseExamFormData(formData: FormData): Record<string, unknown> {
  return {
    courseId: formData.get("courseId") as string,
    title: (formData.get("title") as string)?.trim(),
    description: (formData.get("description") as string)?.trim() || null,
    instructorName: (formData.get("instructorName") as string)?.trim(),
    taNames: ((formData.get("taNames") as string) || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    availabilityStart: (formData.get("availabilityStart") as string) || null,
    availabilityEnd: (formData.get("availabilityEnd") as string) || null,
    durationMinutes: Number(formData.get("durationMinutes")) || 0,
    timerMode: (formData.get("timerMode") as string) || "WHOLE_QUIZ",
    perQuestionSeconds: formData.get("perQuestionSeconds")
      ? Number(formData.get("perQuestionSeconds"))
      : null,
    attemptsAllowed: Number(formData.get("attemptsAllowed")) || 1,
    randomizeQuestions: formData.has("randomizeQuestions"),
    randomizeOptions: formData.has("randomizeOptions"),
    allowBacktracking: formData.has("allowBacktracking"),
    allowExternalStudents: formData.has("allowExternalStudents"),
    continueAfterAvailability: formData.has("continueAfterAvailability"),
    fullScreenRequired: formData.has("fullScreenRequired"),
    reconnectGraceSeconds: Number(formData.get("reconnectGraceSeconds")) || 30,
    maxTabViolations: Number(formData.get("maxTabViolations")) || 2,
    defaultMarks: Number(formData.get("defaultMarks")) || 1,
    defaultNegativeMarks: Number(formData.get("defaultNegativeMarks")) || 0,
    msqGradingPolicy: (formData.get("msqGradingPolicy") as string) || "STRICT",
    numericalTolerance: formData.get("numericalTolerance")
      ? Number(formData.get("numericalTolerance"))
      : null,
    textGradingMode: (formData.get("textGradingMode") as string) || "EXACT",
    resultRelease: (formData.get("resultRelease") as string) || "AUTO",
  };
}
