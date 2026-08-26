import { z } from "zod";

export const CreateCourseSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  code: z
    .string()
    .min(2, "Course code must be at least 2 characters")
    .max(20, "Course code must be 20 characters or less")
    .transform((val) => val.toUpperCase().trim())
    .refine((val) => /^[A-Z0-9]+$/.test(val), {
      message: "Course code must contain only letters and numbers",
    }),
  description: z.string().max(500, "Description too long").optional(),
});

export const UpdateCourseSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  code: z
    .string()
    .min(2)
    .max(20)
    .transform((val) => val.toUpperCase().trim())
    .refine((val) => /^[A-Z0-9]+$/.test(val), {
      message: "Course code must contain only letters and numbers",
    })
    .optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateCourseInput = z.output<typeof CreateCourseSchema>;
export type UpdateCourseInput = z.output<typeof UpdateCourseSchema>;
