/**
 * Pure student identity and eligibility logic — no DB access.
 * All DB checks (roster, existing attempts) happen in the API route.
 */

/** 9-digit numeric student ID (DAU format) */
export function isValidStudentId(id: string): boolean {
  return /^\d{9}$/.test(id.trim());
}

/** DAU institutional email: {9-digit-id}@dau.ac.in */
export function isValidStudentEmail(email: string, studentId: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized === `${studentId.trim()}@dau.ac.in`;
}

export type EligibilityError =
  | "INVALID_STUDENT_ID"
  | "INVALID_EMAIL"
  | "NOT_ON_ROSTER"
  | "ATTEMPTS_EXHAUSTED"
  | "ATTEMPT_IN_PROGRESS";

export interface EligibilityInput {
  studentId: string;
  email: string;
  name: string;
}

/** Validate format fields only. Returns null if valid, error key if not. */
export function validateIdentityFormat(input: EligibilityInput): EligibilityError | null {
  if (!isValidStudentId(input.studentId)) return "INVALID_STUDENT_ID";
  if (!isValidStudentEmail(input.email, input.studentId)) return "INVALID_EMAIL";
  if (!input.name.trim()) return "INVALID_STUDENT_ID"; // name required, reuse generic
  return null;
}
