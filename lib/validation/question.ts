import { z } from "zod";

export const QuestionOptionInputSchema = z.object({
  text: z.string().min(1, "Option text is required").max(1000),
  isCorrect: z.boolean(),
  displayOrder: z.number().int().min(0),
  mediaAssetId: z.string().nullable().optional(),
});

export type QuestionOptionInput = z.infer<typeof QuestionOptionInputSchema>;

const BaseQuestionFields = {
  type: z.enum(["MCQ", "MSQ", "TRUE_FALSE", "SHORT_TEXT", "NUMERICAL", "IMAGE_BASED"] as const),
  text: z.string().min(1, "Question text is required").max(5000),
  marks: z
    .number({ required_error: "Marks are required", invalid_type_error: "Marks must be a number" })
    .positive("Marks must be positive")
    .max(100, "Marks cannot exceed 100"),
  negativeMarks: z
    .number({ invalid_type_error: "Negative marks must be a number" })
    .min(0, "Negative marks cannot be negative")
    .max(100, "Negative marks cannot exceed 100")
    .default(0),
  mediaAssetId: z.string().nullable().optional(),
  options: z.array(QuestionOptionInputSchema).default([]),
  numericalAnswer: z.number().nullable().optional(),
  numericalTolerance: z.number().min(0, "Tolerance cannot be negative").nullable().optional(),
  textAnswer: z.string().max(2000).nullable().optional(),
  explanation: z.string().max(2000).nullable().optional(),
};

export const CreateQuestionSchema = z
  .object(BaseQuestionFields)
  .superRefine((data, ctx) => {
    const optionTypes = ["MCQ", "MSQ", "TRUE_FALSE", "IMAGE_BASED"] as const;
    if (optionTypes.includes(data.type as (typeof optionTypes)[number])) {
      if (data.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least 2 options are required",
          path: ["options"],
        });
        return;
      }
      if (data.options.length > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Cannot have more than 10 options",
          path: ["options"],
        });
      }
      const correctCount = data.options.filter((o) => o.isCorrect).length;
      if (data.type === "MCQ" || data.type === "IMAGE_BASED") {
        if (correctCount !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Exactly one correct option is required",
            path: ["options"],
          });
        }
      }
      if (data.type === "MSQ") {
        if (correctCount < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "At least one correct option is required for MSQ",
            path: ["options"],
          });
        }
      }
      if (data.type === "TRUE_FALSE") {
        if (data.options.length !== 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "True/False must have exactly 2 options",
            path: ["options"],
          });
        }
        if (correctCount !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Exactly one correct option is required",
            path: ["options"],
          });
        }
      }
    }
    if (data.type === "NUMERICAL") {
      if (data.numericalAnswer === null || data.numericalAnswer === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Correct numerical answer is required",
          path: ["numericalAnswer"],
        });
      }
    }
    if (data.type === "SHORT_TEXT") {
      if (!data.textAnswer || data.textAnswer.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Accepted text answer is required for Short Text questions",
          path: ["textAnswer"],
        });
      }
    }
  });

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;

export const UpdateQuestionSchema = z
  .object({
    type: z.enum(["MCQ", "MSQ", "TRUE_FALSE", "SHORT_TEXT", "NUMERICAL", "IMAGE_BASED"] as const).optional(),
    text: z.string().min(1).max(5000).optional(),
    marks: z.number().positive().max(100).optional(),
    negativeMarks: z.number().min(0).max(100).optional(),
    mediaAssetId: z.string().nullable().optional(),
    options: z.array(QuestionOptionInputSchema).optional(),
    numericalAnswer: z.number().nullable().optional(),
    numericalTolerance: z.number().min(0).nullable().optional(),
    textAnswer: z.string().max(2000).nullable().optional(),
    explanation: z.string().max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;

export const ReorderQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().min(1),
        displayOrder: z.number().int().min(0),
      })
    )
    .min(1, "At least one question required"),
});

export type ReorderQuestionsInput = z.infer<typeof ReorderQuestionsSchema>;
