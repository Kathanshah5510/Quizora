import { z } from "zod";

const STUDENT_ID_REGEX = /^\d{9}$/;
const EMAIL_DOMAIN = "@dau.ac.in";

export const StudentIdentitySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  studentId: z
    .string()
    .regex(STUDENT_ID_REGEX, "Student ID must be exactly 9 digits"),
  email: z
    .string()
    .email("Valid email required")
    .refine((e) => e.endsWith(EMAIL_DOMAIN), {
      message: `Email must be a ${EMAIL_DOMAIN} address`,
    }),
}).refine(
  (d) => d.email === `${d.studentId}${EMAIL_DOMAIN}`,
  {
    message: "Email must match student ID (studentId@dau.ac.in)",
    path: ["email"],
  }
);

export type StudentIdentityInput = z.infer<typeof StudentIdentitySchema>;
